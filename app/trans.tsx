import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LanguageSelector, LanguageCode } from './components/LanguageSelector';
import { Sentence } from './constants/types';
import { useAudioPlayer } from 'expo-audio';

const diff = require('diff');
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tatoeba.org/en/api_v0/search';

export default function App() {
    const [targetLang, setTargetLang] = useState<LanguageCode>('deu');
    const [nativeLang, setNativeLang] = useState<LanguageCode>('eng');
    const [sentences, setSentences] = useState<Sentence[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userTranslation, setUserTranslation] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchSentences = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/search?from=${targetLang}&to=${nativeLang}&has_audio=yes&original=yes&sort=random`);
            const data = await response.json();

            if (data.results?.length > 0) {
                const validSentences = data.results.filter(
                    (sentence: Sentence) => sentence.translations && sentence.translations[0]?.length > 0
                );

                if (validSentences.length === 0) {
                    setError('No translations found for selected languages');
                } else {
                    setSentences(validSentences);
                    setCurrentIndex(0);
                }
            } else {
                setError('No sentences found');
            }
        } catch (err) {
            setError('Failed to fetch sentences');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = () => setSubmitted(true);

    const navigateSentence = (direction: 'next' | 'prev') => {
        const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (newIndex >= 0 && newIndex < sentences.length) {
            setCurrentIndex(newIndex);
            setSubmitted(false);
            setUserTranslation('');
        }
    };

    const handleEnterPress = () => {
        if (!submitted) {
            handleSubmit();
        } else {
            navigateSentence('next');
        }
    };

    const differences = submitted && sentences[currentIndex].translations
        ? diff.diffWords(userTranslation, sentences[currentIndex].text || '', { ignoreCase: true }) // Ensure translations[0][0] exists
        : [];

    // Automatically focus on the input
    useEffect(() => {
        if (currentIndex < sentences.length - 1) {
            this.translationInput.focus();
        }
    }, [sentences, currentIndex]);

    const audioUrl = `https://tatoeba.org/audio/download/${sentences[currentIndex]?.audios[0].id}`
    const player = useAudioPlayer(audioUrl);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Language Selectors */}
            <View style={styles.languageSelector}>
                <LanguageSelector
                    selectedValue={targetLang}
                    onValueChange={setTargetLang}
                    label="Target"
                />
                <LanguageSelector
                    selectedValue={nativeLang}
                    onValueChange={setNativeLang}
                    label="Native"
                />
            </View>

            <Button
                title={loading ? 'Loading...' : 'Load Sentences'}
                onPress={fetchSentences}
                disabled={loading}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {sentences.length > 0 && (
                <View style={styles.exerciseContainer}>
                    <Text style={styles.tracker}>
                        {currentIndex + 1} / {sentences.length}
                    </Text>
                    <TouchableOpacity onPress={() => player.play()}>
                        <Text style={styles.playButton}>Play Audio</Text>
                    </TouchableOpacity>
                    <Text style={styles.sentence}>{sentences[currentIndex].translations[0][0]?.text}</Text>
                    <TextInput
                        ref={(input) => { this.translationInput = input; }}
                        style={[styles.input, styles.translationInput]}
                        placeholder="Enter your translation"
                        value={userTranslation}
                        onChangeText={setUserTranslation}
                        editable={!submitted}
                        onSubmitEditing={handleEnterPress}
                        returnKeyType={submitted ? 'next' : 'done'}
                        blurOnSubmit={false}
                    />

                    {!submitted ? (
                        <Button title="Submit" onPress={handleSubmit} />
                    ) : (
                        <View style={styles.resultContainer}>
                            <Text style={styles.resultHeading}>Correct Translation:</Text>
                            <View style={styles.correctTranslation}>
                                {differences.filter(part => !part.removed).map((part, i) => (
                                    <Text
                                        key={i}
                                        style={part.added ? styles.addedText : styles.normalText}
                                    >
                                        {part.value}
                                    </Text>
                                ))}
                            </View>
                        </View>
                    )}

                    <View style={styles.navigation}>
                        <Button
                            title="Previous"
                            onPress={() => navigateSentence('prev')}
                            disabled={currentIndex === 0}
                        />
                        <Button
                            title="Next"
                            onPress={() => navigateSentence('next')}
                            disabled={currentIndex === sentences.length - 1}
                        />
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    playButton: {
        marginBottom: 10,
        alignSelf: 'center',
        backgroundColor: '#007AFF',
        padding: 10,
        borderRadius: 5,
        marginTop: 10,
        color: '#fff',
    },
    tracker: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 10,
        color: '#666',
    },
    languageSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        fontSize: 16,
    },
    translationInput: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    error: {
        color: 'red',
        marginVertical: 10,
        textAlign: 'center',
    },
    exerciseContainer: {
        marginTop: 20,
    },
    sentence: {
        fontSize: 18,
        marginBottom: 20,
        lineHeight: 24,
        color: '#333',
    },
    resultContainer: {
        marginTop: 20,
    },
    resultHeading: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        color: '#444',
    },
    correctTranslation: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        padding: 12,
    },
    normalText: {
        fontSize: 16,
        color: '#333',
    },
    addedText: {
        fontSize: 16,
        backgroundColor: '#c8f5c4',
        color: '#1a531b',
    },
    navigation: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        gap: 10,
    },
});