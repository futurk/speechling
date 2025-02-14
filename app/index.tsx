import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity
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
    sentenceDelay: 3,
    translationDelay: 2,
    sound: null,
    translationSound: null,
    repeatOriginalAfterTranslation: true,
  });

  const timerRef = useRef<number | null>(null); // Use `number` instead of `Timeout`
  const isMounted = useRef(true);
  const sentenceDelayRef = useRef(state.sentenceDelay);
  const translationDelayRef = useRef(state.translationDelay);
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

  const fetchSentences = async () => {
    try {
      setState(s => ({ ...s, isLoading: true }));
      const response = await axios.get<{ results: Sentence[] }>(API_URL, {
        params: {
          from: state.fromLang,
          to: state.toLang,
          trans_to: state.toLang,
          has_audio: 'yes',
          trans_has_audio: 'yes',
          sort: 'random',
          page: 1
          //word_count_min: 10,
        }
      });

      if (isMounted.current) {
        setState(s => ({
          ...s,
          sentences: response.data.results,
          isLoading: false,
          currentIndex: 0,
          isPlaying: false
        }));
      }
    } catch (error) {
      console.error(error);
      setState(s => ({ ...s, isLoading: false }));
    }
  };

  const fetchMoreSentences = async () => {
    try {
      const response = await axios.get<{ results: Sentence[] }>(API_URL, {
        params: {
          from: state.fromLang,
          to: state.toLang,
          trans_to: state.toLang,
          has_audio: 'yes',
          trans_has_audio: 'yes',
          sort: 'random',
          page: 1
        }
      });

      if (isMounted.current) {
        setState(s => ({
          ...s,
          sentences: [...s.sentences, ...response.data.results], // Append new sentences
        }));
      }
    } catch (error) {
      console.error('Error fetching more sentences:', error);
    }
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
      setState(s => ({ ...s, sound: null, translationSound: null }));
    }
  };

  const playAudio = async (audioId: number, isTranslation = false, signal?: AbortSignal): Promise<void> => {
    await stopAudio();
    if (signal?.aborted) return;

    const audioUrl = `https://tatoeba.org/audio/download/${audioId}`;
    console.log('Attempting to play audio from URL:', audioUrl);

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      if (signal?.aborted) {
        await sound.unloadAsync();
        return;
      }

      if (isMounted.current) {
        setState(s => ({ ...s, [isTranslation ? 'translationSound' : 'sound']: sound }));
      }

      return new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          sound.unloadAsync()
            .then(() => resolve()) // Explicitly resolve with void
            .catch(() => resolve()); // Explicitly resolve with void
          reject(new DOMException('Aborted', 'AbortError'));
        };

        signal?.addEventListener('abort', onAbort);

        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (!status.isLoaded) return; // Skip if status is not loaded

          if ('didJustFinish' in status && status.didJustFinish) {
            console.log('Audio playback finished');
            signal?.removeEventListener('abort', onAbort);
            resolve(); // Resolve with void
          }

          if ('error' in status) {
            console.error('Audio playback error:', status.error);
            signal?.removeEventListener('abort', onAbort);
            reject(status.error);
          }
        });
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
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
      await new Promise((resolve, reject) => {
        timerRef.current = setTimeout(resolve, sentenceDelayRef.current * 1000) as unknown as number;
        controller.signal.addEventListener('abort', () => {
          clearTimeout(timerRef.current!);
          timerRef.current = null;
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

      if (controller.signal.aborted) return;

      // Play translation audio (if available)
      console.log('Playing translation audio');
      if (translation?.audios?.length) {
        await playAudio(translation.audios[0].id, true, controller.signal);
        if (controller.signal.aborted) return;
      }

      // Translation delay
      console.log('Translation delay is going to finish in:', translationDelayRef.current)
      await new Promise((resolve, reject) => {
        timerRef.current = setTimeout(resolve, translationDelayRef.current * 1000) as unknown as number;
        controller.signal.addEventListener('abort', () => {
          clearTimeout(timerRef.current!);
          timerRef.current = null;
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

      // Repeat original audio if enabled
      console.log(state.repeatOriginalAfterTranslation, currentSentence.audios?.length);
      if (state.repeatOriginalAfterTranslation && currentSentence.audios?.length) {
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
      setState(s => ({ ...s, currentIndex: nextIndex, showTranslation: false }));

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
      const newIndex = Math.max(0, Math.min(state.sentences.length - 1, state.currentIndex + direction));

      setState(s => ({
        ...s,
        currentIndex: newIndex,
        showTranslation: false
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
    <View style={styles.container}>
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

      <TouchableOpacity
        style={styles.fetchButton}
        onPress={fetchSentences}
      >
        <Text style={styles.buttonText}>Reload Sentences</Text>
      </TouchableOpacity>

      {currentSentence.text && (
        <View style={styles.card}>
          <Text style={styles.sentenceText}>{currentSentence.text}</Text>

          <View style={styles.controls}>
            <TouchableOpacity onPress={() => changeIndex(-1)}>
              <Text style={styles.controlText}>⏮</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={togglePlayback}>
              <Text style={styles.controlText}>
                {state.isPlaying ? '⏸' : '▶'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => changeIndex(1)}>
              <Text style={styles.controlText}>⏭</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.delayControls}>
            <View style={styles.delayGroup}>
              <Text>After Sentence: {state.sentenceDelay}s</Text>
              <Slider
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={state.sentenceDelay}
                onValueChange={handleSentenceDelayChange}
                style={styles.slider}
              />
            </View>

            <View style={styles.delayGroup}>
              <Text>After Translation: {state.translationDelay}s</Text>
              <Slider
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={state.translationDelay}
                onValueChange={handleTranslationDelayChange}
                style={styles.slider}
              />
            </View>
            <TouchableOpacity
              style={styles.repeatButton}
              onPress={() => setState(s => ({ ...s, repeatOriginalAfterTranslation: !s.repeatOriginalAfterTranslation }))}
            >
              <Text style={styles.buttonText}>
                {state.repeatOriginalAfterTranslation ? '✅ Repeat Original' : '🔁 Repeat Original'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.translationButton}
            onPress={() => setState(s => ({ ...s, showTranslation: !s.showTranslation }))}
          >
            <Text style={styles.buttonText}>
              {state.showTranslation ? 'Hide Translation' : 'Show Translation'}
            </Text>
          </TouchableOpacity>

          {state.showTranslation && translation?.text && (
            <Text style={styles.translationText}>{translation.text}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  repeatButton: {
    backgroundColor: '#8e44ad',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  picker: {
    height: 50,
    width: '48%',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    elevation: 5,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
  },
  controlText: {
    fontSize: 32,
    color: '#2c3e50',
  },
  sentenceText: {
    fontSize: 20,
    textAlign: 'center',
    marginVertical: 15,
    color: '#34495e',
  },
  translationText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
  },
  delayControls: {
    marginVertical: 15,
  },
  delayGroup: {
    marginBottom: 15,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  fetchButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  translationButton: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
