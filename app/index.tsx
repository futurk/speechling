import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Picker } from '@react-native-picker/picker';
import { Audio } from 'expo-av';
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
  });

  const timerRef = useRef<number | null>(null); // Use `number` instead of `Timeout`
  const isMounted = useRef(true);
  const sentenceDelayRef = useRef(state.sentenceDelay);
  const translationDelayRef = useRef(state.translationDelay);

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
          word_count_min: 10, // remove on production
          has_audio: 'yes',
          trans_has_audio: 'yes',
          sort: 'random',
          page: 1
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

  const stopAudio = async () => {
    console.log('Stopping audio...');
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

  const playAudio = async (audioId: number, isTranslation = false): Promise<void> => {
    await stopAudio();
    const audioUrl = `https://tatoeba.org/audio/download/${audioId}`;
    console.log('Attempting to play audio from URL:', audioUrl);

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      if (isMounted.current) {
        setState(s => ({ ...s, [isTranslation ? 'translationSound' : 'sound']: sound }));
      }

      // Return a promise that resolves when playback finishes
      return new Promise((resolve) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return; // Skip if status is not loaded
          if (status.didJustFinish) {
            console.log('Audio playback finished');
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  };

  const handleAutoPlay = async (currentIndex: number) => {
    console.log('Starting auto-play for index:', currentIndex);
    if (!state.sentences.length || !state.isPlaying) return;

    try {
      const currentSentence = state.sentences[currentIndex];
      const translation = currentSentence.translations[0]?.[0];

      // Wait for 500ms before playing audio
      console.log('Wait for 500ms before playing audio');
      await new Promise(resolve => {
        timerRef.current = setTimeout(resolve, 500) as unknown as number;
      });

      // Play original audio and wait for it to finish
      if (currentSentence.audios?.length) {
        console.log('Playing original audio');
        await playAudio(currentSentence.audios[0].id);
      }

      // Wait for sentence delay (using ref value)
      console.log('Starting sentence delay:', sentenceDelayRef.current);
      await new Promise(resolve => {
        timerRef.current = setTimeout(resolve, sentenceDelayRef.current * 1000) as unknown as number;
      });

      // Play translation audio and wait for it to finish
      if (translation?.audios?.length) {
        console.log('Playing translation audio');
        await playAudio(translation.audios[0].id, true);
      }

      // Wait for translation delay (using ref value)
      console.log('Starting translation delay:', translationDelayRef.current);
      await new Promise(resolve => {
        timerRef.current = setTimeout(resolve, sentenceDelayRef.current * 1000) as unknown as number;
      });

      if (isMounted.current && state.isPlaying) {
        const nextIndex = (currentIndex + 1) % state.sentences.length;
        console.log('Moving to next index:', nextIndex);

        // Update state.currentIndex
        setState(s => ({
          ...s,
          currentIndex: nextIndex,
          showTranslation: false
        }));

        // Fetch new sentences if near the end
        if (nextIndex === state.sentences.length - 1) {
          fetchSentences();
        }

        // Continue auto-play with the updated index
        handleAutoPlay(nextIndex);
      }
    } catch (error) {
      console.error('Error in auto-play:', error);
      setState(s => ({ ...s, isPlaying: false }));
    }
  };

  const togglePlayback = () => {
    setState(s => ({ ...s, isPlaying: !s.isPlaying }));
  };

  const changeIndex = async (direction: number) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    try {
      await stopAudio(); // Stop any currently playing audio
    } catch (error) {
      console.error('Error stopping audio:', error);
    }

    setState(s => {
      const newIndex = Math.max(0, Math.min(s.sentences.length - 1, s.currentIndex + direction));
      return {
        ...s,
        currentIndex: newIndex,
        showTranslation: false
      };
    });

    // If auto-play is enabled, start playing the new sentence
    if (state.isPlaying) {
      handleAutoPlay(state.currentIndex + direction);
    }
  };

  if (state.isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

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
        <Text style={styles.buttonText}>Load Sentences</Text>
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
