import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Picker } from '@react-native-picker/picker';
import { Audio, AVPlaybackStatus } from 'expo-av';
import axios from 'axios';

type LanguageCode = keyof typeof LANGUAGES;

interface Sentence {
  id: number;
  text: string;
  lang: string;
  audios: Array<{ id: number }>;
  translations: Array<Array<{
    text: string;
    audios: Array<{ id: number }>;
  }>>;
}

interface AppState {
  fromLang: LanguageCode;
  toLang: LanguageCode;
  sentences: Sentence[];
  currentIndex: number;
  isLoading: boolean;
  isPlaying: boolean;
  showTranslation: boolean;
  sentenceDelay: number;
  translationDelay: number;
  sound: Audio.Sound | null;
  translationSound: Audio.Sound | null;
  repeatOriginalAfterTranslation: boolean;
  isAudioLoading: boolean;
  isAudioPlaying: boolean;
}

const LANGUAGES = {
  deu: 'German',
  eng: 'English',
  fra: 'French',
  spa: 'Spanish',
  ita: 'Italian',
  jpn: 'Japanese',
  tur: 'Turkish',
};

export default function App() {
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tatoeba.org/en/api_v0/search';
  const [state, setState] = useState<AppState>({
    fromLang: 'deu',
    toLang: 'eng',
    sentences: [],
    currentIndex: 0,
    isLoading: true, // change to false when testing
    isPlaying: false,
    showTranslation: false,
    sentenceDelay: 1,
    translationDelay: 1,
    sound: null,
    translationSound: null,
    repeatOriginalAfterTranslation: true,
    isAudioLoading: false,
    isAudioPlaying: false,
  });

  const timerRef = useRef<number | null>(null); // Use `number` instead of `Timeout`
  const isMounted = useRef(true);
  const sentenceDelayRef = useRef(state.sentenceDelay);
  const translationDelayRef = useRef(state.translationDelay);
  const repeatOriginalAfterTranslationRef = useRef(state.repeatOriginalAfterTranslation);
  const playbackController = useRef<AbortController | null>(null);
  const currentPlaybackId = useRef(0);

  const handleSentenceDelayChange = (value: number) => {
    sentenceDelayRef.current = value; // Update ref
    setState(s => ({ ...s, sentenceDelay: value })); // Update state
  };

  const handleTranslationDelayChange = (value: number) => {
    translationDelayRef.current = value; // Update ref
    setState(s => ({ ...s, translationDelay: value })); // Update state
  };

  useEffect(() => {
    repeatOriginalAfterTranslationRef.current = state.repeatOriginalAfterTranslation;
  }, [state.repeatOriginalAfterTranslation]);

  useEffect(() => {
    fetchSentences(); // comment when testing
    return () => {
      isMounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      stopAudio();
    };
  }, []);

  useEffect(() => {
    if (isMounted.current && !state.isLoading) {
      fetchSentences(); // comment when testing
    }
  }, [state.fromLang, state.toLang]);

  useEffect(() => {
    if (state.isPlaying) {
      handleAutoPlay(state.currentIndex); // Pass the current index
    } else {
      // Clear timers and pause audio when stopping
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (state.sound) {
        state.sound.pauseAsync();
      }
      if (state.translationSound) {
        state.translationSound.pauseAsync();
      }
    }
  }, [state.isPlaying]); // Trigger when isPlaying changes

  const fetchSentences = async (append = false) => {
    try {
      if (!append) {
        setState(s => ({ ...s, isLoading: true }));
      }

      const params: Record<string, string> = {
        from: state.fromLang,
        to: state.toLang,
        trans_to: state.toLang,
        has_audio: 'yes',
        trans_has_audio: 'yes',
        sort: 'random',
        page: '1',
      };

      const response = await axios.get<{ results: Sentence[] }>(API_URL, { params });

      if (isMounted.current) {
        setState(s => ({
          ...s,
          sentences: append ? [...s.sentences, ...response.data.results] : response.data.results,
          isLoading: false,
          currentIndex: append ? s.currentIndex : 0,
          isPlaying: false,
        }));
      }
    } catch (error) {
      console.error(error);
      setState(s => ({ ...s, isLoading: false }));
    }
  };

  const fetchMoreSentences = async () => {
    await fetchSentences(true);
  };

  const stopAudio = async () => {
    try {
      if (state.sound) {
        const status = await state.sound.getStatusAsync();
        if (status.isLoaded) {
          console.log('Pausing main audio');
          await state.sound.pauseAsync();
        }
      }
      if (state.translationSound) {
        const status = await state.translationSound.getStatusAsync();
        if (status.isLoaded) {
          console.log('Pausing translation audio');
          await state.translationSound.pauseAsync();
        }
      }
    } catch (error) {
      console.error('Error stopping audio:', error);
    } finally {
      setState(s => ({ ...s, sound: null, translationSound: null, isAudioLoading: false, isAudioPlaying: false }));
    }
  };

  const playAudio = async (audioId: number, isTranslation = false, signal?: AbortSignal): Promise<void> => {
    await stopAudio();
    if (signal?.aborted) return;

    const audioUrl = `https://tatoeba.org/audio/download/${audioId}`;
    console.log('Attempting to play audio from URL:', audioUrl);

    try {
      // Set state
      setState(s => ({ ...s, isAudioLoading: false }));

      // Start a timeout before switching the state
      const loadingTimeout = setTimeout(() => {
        if (isMounted.current) {
          setState(s => ({ ...s, isAudioLoading: true }));
        }
      }, 1500); // 3 seconds

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      // Clear the loading timeout
      clearTimeout(loadingTimeout);

      if (signal?.aborted) {
        await sound.unloadAsync();
        return;
      }

      if (isMounted.current) {
        setState(s => ({
          ...s,
          [isTranslation ? 'translationSound' : 'sound']: sound,
          isAudioLoading: false,
          isAudioPlaying: true,
        }));
      }

      return new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          sound.unloadAsync()
            .then(() => resolve())
            .catch(() => resolve());
          reject(new DOMException('Aborted', 'AbortError'));
        };

        signal?.addEventListener('abort', onAbort);

        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;

          if ('didJustFinish' in status && status.didJustFinish) {
            console.log('Audio playback finished');
            signal?.removeEventListener('abort', onAbort);
            setState(s => ({ ...s, isAudioPlaying: false }));
            resolve();
          }

          if ('error' in status) {
            console.error('Audio playback error:', status.error);
            signal?.removeEventListener('abort', onAbort);
            setState(s => ({ ...s, isAudioLoading: false, isAudioPlaying: false }));
            reject(status.error);
          }
        });
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Error playing audio:', error);
      setState(s => ({ ...s, isAudioLoading: false, isAudioPlaying: false }));
      throw error;
    }
  };

  const findTranslationWithAudio = (translations: Sentence['translations']) => {
    for (let i = 0; i < translations.length; i++) {
      for (let j = 0; j < translations[i].length; j++) {
        const translation = translations[i][j];
        if (translation?.audios?.length) {
          return translation;
        }
      }
    }
    return null;
  };

  const delay = (seconds: number, signal?: AbortSignal): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, seconds * 1000);
      signal?.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  };

  const handleAutoPlay = async (currentIndex: number) => {
    playbackController.current?.abort();
    const controller = new AbortController();
    playbackController.current = controller;
    const playbackId = ++currentPlaybackId.current;

    console.log('currentIndex:', currentIndex, 'Total sentences:', state.sentences.length);

    try {
      // Fetch more sentences if we're nearing the end
      if (currentIndex >= state.sentences.length - 5) {
        await fetchMoreSentences();
      }

      const currentSentence = state.sentences[currentIndex];
      const translation = findTranslationWithAudio(currentSentence.translations);

      console.log('', currentSentence);

      // Add initial cooldown
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 500);
        controller.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

      if (controller.signal.aborted || playbackId !== currentPlaybackId.current) return;

      // Play original audio
      console.log('Playing original audio');
      if (currentSentence.audios?.length) {
        await playAudio(currentSentence.audios[0].id, false, controller.signal);
        if (controller.signal.aborted) return;
      }

      // Sentence delay
      console.log('Sentence delay is going to finish in:', sentenceDelayRef.current)
      await delay(sentenceDelayRef.current, controller.signal);

      if (controller.signal.aborted) return;

      // Play translation audio (if available)
      console.log('Playing translation audio');
      if (translation?.audios?.length) {
        await playAudio(translation.audios[0].id, true, controller.signal);
        if (controller.signal.aborted) return;
      }

      // Translation delay
      console.log('Translation delay is going to finish in:', translationDelayRef.current)
      await delay(translationDelayRef.current, controller.signal);

      // Repeat original audio if enabled
      console.log(repeatOriginalAfterTranslationRef.current, currentSentence.audios?.length);
      if (repeatOriginalAfterTranslationRef.current && currentSentence.audios?.length) {
        // Play original audio
        await playAudio(currentSentence.audios[0].id, false, controller.signal);
        if (controller.signal.aborted) return;
        // Sentence delay
        await new Promise((resolve, reject) => {
          timerRef.current = setTimeout(resolve, sentenceDelayRef.current * 1000) as unknown as number;
          controller.signal.addEventListener('abort', () => {
            clearTimeout(timerRef.current!);
            timerRef.current = null;
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }

      if (!isMounted.current || !state.isPlaying) return;

      const nextIndex = (currentIndex + 1);
      setState(s => ({ ...s, currentIndex: nextIndex }));

      handleAutoPlay(nextIndex);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Error in auto-play:', error);
        setState(s => ({ ...s, isPlaying: false }));
      }
    }
  };

  const togglePlayback = async () => {
    if (state.isPlaying) {
      // Pause: stop audio and clear timers
      playbackController.current?.abort();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      await stopAudio();
      setState(s => ({ ...s, isPlaying: false }));
    } else {
      // Resume: restart current sentence
      setState(s => ({ ...s, isPlaying: true }));
      handleAutoPlay(state.currentIndex);
    }
  };

  const changeIndex = async (direction: number) => {
    playbackController.current?.abort();
    currentPlaybackId.current++;

    try {
      await stopAudio();

      // Add a small delay to absorb rapid clicks
      await new Promise(resolve => setTimeout(resolve, 100));

      const newIndex = Math.max(0, Math.min(state.sentences.length - 1, state.currentIndex + direction));
      console.log('newIndex:', newIndex);
      setState(s => ({
        ...s,
        currentIndex: newIndex
      }));

      if (state.isPlaying) {
        handleAutoPlay(newIndex);
      }
    } catch (error) {
      console.error('Error changing index:', error);
    }
  };

  const currentSentence = state.sentences[state.currentIndex] || {};
  const translation = currentSentence.translations?.[0]?.[0];

  return (
    <ScrollView style={styles.container}>
      {state.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading sentences...</Text>
        </View>
      ) : (
        <>
          <View>
            {/* Language Selectors */}
            <View style={styles.languageSelector}>
              <Picker
                selectedValue={state.fromLang}
                style={styles.picker}
                onValueChange={(value: LanguageCode) =>
                  setState(s => ({ ...s, fromLang: value }))
                }
              >
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <Picker.Item
                    key={code}
                    label={`Practice: ${name}`}
                    value={code}
                  />
                ))}
              </Picker>

              <Picker
                selectedValue={state.toLang}
                style={styles.picker}
                onValueChange={(value: LanguageCode) =>
                  setState(s => ({ ...s, toLang: value }))
                }
              >
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <Picker.Item
                    key={code}
                    label={`Translate: ${name}`}
                    value={code}
                  />
                ))}
              </Picker>
            </View>

            {/* Reload Button */}
            <TouchableOpacity
              style={styles.reloadButton}
              onPress={() => fetchSentences()}
            >
              <Text style={styles.buttonText}>Reload Sentences</Text>
            </TouchableOpacity>
          </View>

          {/* Sentence Card */}
          {currentSentence.text && (
            <View style={styles.card}>
              {/* Sentence and Translation */}
              <View style={styles.sentenceContainer}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                  <Text style={styles.sentenceText}>{currentSentence.text}</Text>
                  {state.showTranslation && translation?.text && (
                    <Text style={styles.translationText}>{translation.text}</Text>
                  )}
                </ScrollView>
              </View>

              {/* Delay Controls and Toggle Container */}
              <View style={styles.playbackSettings}>
                {/* First Column: Delay Controls */}
                <View style={styles.delayControls}>
                  <View style={styles.delayGroup}>
                    <Text style={styles.delayLabel}>Delay after sentence: {state.sentenceDelay}s</Text>
                    <Slider
                      minimumValue={1}
                      maximumValue={5}
                      step={1}
                      value={state.sentenceDelay}
                      onValueChange={handleSentenceDelayChange}
                      style={styles.slider}
                      minimumTrackTintColor="#4A90E2"
                      maximumTrackTintColor="#ECF0F1"
                      thumbTintColor="#4A90E2"
                    />
                  </View>
                  <View style={styles.delayGroup}>
                    <Text style={styles.delayLabel}>Delay after translation: {state.translationDelay}s</Text>
                    <Slider
                      minimumValue={1}
                      maximumValue={5}
                      step={1}
                      value={state.translationDelay}
                      onValueChange={handleTranslationDelayChange}
                      style={styles.slider}
                      minimumTrackTintColor="#4A90E2"
                      maximumTrackTintColor="#ECF0F1"
                      thumbTintColor="#4A90E2"
                    />
                  </View>
                </View>

                {/* Second Column: Toggle Container */}
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    style={[styles.toggleButton, state.repeatOriginalAfterTranslation && styles.toggleButtonActive]}
                    onPress={() => setState(s => ({ ...s, repeatOriginalAfterTranslation: !s.repeatOriginalAfterTranslation }))}
                  >
                    <Text style={styles.toggleButtonText}>
                      {state.repeatOriginalAfterTranslation ? '✅ Repeat' : '🔁 Repeat'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleButton, state.showTranslation && styles.toggleButtonActive]}
                    onPress={() => setState(s => ({ ...s, showTranslation: !s.showTranslation }))}
                  >
                    <Text style={styles.toggleButtonText}>
                      {state.showTranslation ? '✅ Hide Translation' : '🌐 Show Translation'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>


              {/* Playback Controls */}
              <View style={styles.playbackControls}>
                <TouchableOpacity onPress={() => changeIndex(-1)}>
                  <Text style={styles.controlText}>⏮</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={togglePlayback}>
                  {state.isAudioLoading ? (
                    <ActivityIndicator size="small" color="#4A90E2" /> // Loading icon
                  ) : state.isAudioPlaying ? (
                    <Text style={styles.controlText}>🔊</Text> // Audio playing icon
                  ) : (
                    <Text style={styles.controlText}>{state.isPlaying ? '⏸' : '▶'}</Text> // Play/pause icon
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => changeIndex(1)}>
                  <Text style={styles.controlText}>⏭</Text>
                </TouchableOpacity>
              </View>

            </View>
          )}
        </>
      )}

      {/* Credits Footer */}
      <View style={styles.creditsContainer}>
        <Text style={styles.creditsText}>
          Developed by{' '}
          <Text
            style={styles.linkText}
            onPress={() => Linking.openURL('https://github.com/futurk')}
          >
            Furkan Ünlütürk
          </Text>{' '}
          | Data from{' '}
          <Text
            style={styles.linkText}
            onPress={() => Linking.openURL('https://tatoeba.org')}
          >
            Tatoeba
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  playbackSettings: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A90E2', // Primary blue
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F8F9FA', // Light gray background
  },
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  picker: {
    height: 50,
    width: '48%',
    backgroundColor: '#FFFFFF', // White background
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0', // Light gray border
  },
  reloadButton: {
    backgroundColor: '#4A90E2', // Primary blue
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sentenceContainer: {
    height: 120, // Fixed height
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0', // Light gray border
    borderRadius: 8,
    padding: 8,
    justifyContent: 'center', // Center content vertically
    alignItems: 'center', // Center content horizontally
  },
  scrollContent: {
    flexGrow: 1, // Allow content to expand vertically
    justifyContent: 'center', // Center content vertically
    alignItems: 'center', // Center content horizontally
  },
  sentenceText: {
    fontSize: 20,
    textAlign: 'center',
    color: '#2C3E50', // Dark gray text
    fontWeight: '500',
  },
  translationText: {
    fontSize: 16,
    color: '#7F8C8D', // Light gray text
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  playbackControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  controlText: {
    fontSize: 32,
    color: '#4A90E2',
  },
  delayControls: {
    flex: 1,
    marginRight: 4,
  },
  delayGroup: {
    marginBottom: 12,
    height: 60, // Set a fixed height to match toggle buttons
    justifyContent: 'center',
  },
  delayLabel: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  toggleContainer: {
    flex: 1,
    marginLeft: 4,
    justifyContent: 'center',
  },
  toggleButton: {
    height: 60, // Match the height with `delayGroup`
    backgroundColor: '#ECF0F1',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center', // Center content within button
    marginBottom: 12,
  },
  toggleButtonActive: {
    backgroundColor: '#4A90E2',
  },
  toggleButtonText: {
    color: '#2C3E50',
    fontWeight: '500',
  },
  buttonText: {
    color: '#FFFFFF', // White text
    fontWeight: 'bold',
  },
  creditsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0', // Light gray border
    alignItems: 'center',
  },
  creditsText: {
    fontSize: 14,
    color: '#7F8C8D', // Light gray text
  },
  linkText: {
    color: '#4A90E2', // Primary blue
    textDecorationLine: 'underline',
  },
});