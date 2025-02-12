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
};

export default function App() {
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tatoeba.org/en/api_v0/search';
  const [state, setState] = useState<AppState>({
    fromLang: 'deu',
    toLang: 'eng',
    sentences: [],
    currentIndex: 0,
    isLoading: false,
    isPlaying: false,
    showTranslation: false,
    sentenceDelay: 3,
    translationDelay: 2,
    sound: null,
    translationSound: null,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    // fetchSentences();
    return () => {
      isMounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      stopAudio();
    };
  }, []);

  useEffect(() => {
    if (isMounted.current && !state.isLoading) {
      // fetchSentences();
    }
  }, [state.fromLang, state.toLang]);

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
    if (state.sound) await state.sound.unloadAsync();
    if (state.translationSound) await state.translationSound.unloadAsync();
    setState(s => ({ ...s, sound: null, translationSound: null }));
  };

  const playAudio = async (audioId: number, isTranslation = false) => {
    await stopAudio();
    const audioUrl = `https://tatoeba.org/audio/download/${audioId}`;
    const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });

    if (isMounted.current) {
      setState(s => ({ ...s, [isTranslation ? 'translationSound' : 'sound']: sound }));
      await sound.playAsync();
    }
  };

  const handleAutoPlay = async () => {
    console.log('Starting auto-play');
    if (!state.sentences.length) return; // Only check for sentences

    try {
      const currentSentence = state.sentences[state.currentIndex];
      const translation = currentSentence.translations[0]?.[0];

      if (currentSentence.audios?.length) {
        console.log('Playing original audio');
        await playAudio(currentSentence.audios[0].id);
      }

      await new Promise(resolve => {
        timerRef.current = setTimeout(resolve, state.sentenceDelay * 1000);
      });

      if (translation?.audios?.length) {
        console.log('Playing translation audio');
        await playAudio(translation.audios[0].id, true);
      }

      await new Promise(resolve => {
        timerRef.current = setTimeout(resolve, state.translationDelay * 1000);
      });

      if (isMounted.current) {
        const nextIndex = (state.currentIndex + 1) % state.sentences.length;
        setState(s => ({
          ...s,
          currentIndex: nextIndex,
          showTranslation: false
        }));

        if (nextIndex === state.sentences.length - 1) {
          fetchSentences();
        }

        // Continue auto-play if still playing
        if (state.isPlaying) {
          handleAutoPlay();
        }
      }
    } catch (error) {
      console.error('Error in auto-play:', error);
      setState(s => ({ ...s, isPlaying: false }));
    }
  };

  const togglePlayback = () => {
    setState(s => {
      const newState = { ...s, isPlaying: !s.isPlaying };
      console.log('Toggle playback - newState.isPlaying:', newState.isPlaying);

      // If stopping, pause audio and clear timers
      if (!newState.isPlaying) {
        if (state.sound) {
          state.sound.pauseAsync(); // Pause the current audio
        }
        if (state.translationSound) {
          state.translationSound.pauseAsync(); // Pause the translation audio
        }
        if (timerRef.current) {
          clearTimeout(timerRef.current); // Clear any pending timers
        }
      }

      // If starting, call handleAutoPlay after state updates
      if (newState.isPlaying) {
        setTimeout(() => {
          handleAutoPlay();
        }, 0); // Use setTimeout to ensure state is updated
      }

      return newState;
    });
  };

  const changeIndex = (direction: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopAudio();
    setState(s => ({
      ...s,
      currentIndex: Math.max(0, Math.min(s.sentences.length - 1, s.currentIndex + direction)),
      isPlaying: false,
      showTranslation: false
    }));
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
              label={`Learn: ${name}`}
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
                onValueChange={(value: number) =>
                  setState(s => ({ ...s, sentenceDelay: value }))
                }
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
                onValueChange={(value: number) =>
                  setState(s => ({ ...s, translationDelay: value }))
                }
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
