import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import axios from 'axios';

export default function App() {
  const [sentences, setSentences] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sound, setSound] = useState(null);

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const fetchSentences = async () => {
    try {
      const response = await axios.get(API_URL, {
        params: {
          from: 'deu',
          to: 'eng',
          trans_to: 'eng',
          has_audio: 'yes',
          trans_has_audio: 'yes',
          sort: 'random',
          page: 1
        }
      });
      setSentences(response.data.results);
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSentences();
  }, []);

  const playAudio = async (audioId) => {
    if (sound) {
      await sound.unloadAsync();
    }
    const audioUrl = `https://tatoeba.org/audio/download/${audioId}`;
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: audioUrl }
    );
    setSound(newSound);
    await newSound.playAsync();
  };

  const handleNext = () => {
    setShowTranslation(false);
    setCurrentIndex(prev => (prev + 1) % sentences.length);
    if (currentIndex === sentences.length - 2) {
      fetchSentences();
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (!sentences.length) {
    return (
      <View style={styles.container}>
        <Text>No sentences found</Text>
      </View>
    );
  }

  const currentSentence = sentences[currentIndex];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>German Listening Practice</Text>

      <View style={styles.card}>
        <Text style={styles.germanText}>
          {currentSentence.text}
        </Text>

        <TouchableOpacity
          style={styles.audioButton}
          onPress={() => playAudio(currentSentence.audios[0].id)}
        >
          <Text style={styles.buttonText}>▶ Play Audio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setShowTranslation(!showTranslation)}
        >
          <Text style={styles.buttonText}>
            {showTranslation ? 'Hide Translation' : 'Show Translation'}
          </Text>
        </TouchableOpacity>

        {showTranslation && (
          <View style={styles.translationContainer}>
            <Text style={styles.translationTitle}>Translations:</Text>
            {currentSentence.translations[0]?.map((translation, index) => (
              <Text key={index} style={styles.translationText}>
                • {translation.text}
              </Text>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.nextButton}
        onPress={handleNext}
      >
        <Text style={styles.buttonText}>Next Sentence →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#2c3e50',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    marginBottom: 20,
  },
  germanText: {
    fontSize: 20,
    marginBottom: 20,
    textAlign: 'center',
    color: '#34495e',
  },
  audioButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  nextButton: {
    backgroundColor: '#e67e22',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  translationContainer: {
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    paddingTop: 15,
  },
  translationTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#7f8c8d',
  },
  translationText: {
    color: '#2c3e50',
    marginBottom: 5,
  },
});