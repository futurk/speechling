import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
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
    const [userInputText, setUserInputText] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showTranslation, setShowTranslation] = useState(false);

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
                    setShowTranslation(false);
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
            setUserInputText('');
            setShowTranslation(false);
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
        ? diff.diffWords(userInputText, sentences[currentIndex].text || '', { ignoreCase: true })
        : [];

    useEffect(() => {
        if (currentIndex < sentences.length - 1) {
            this.userInput.focus();
        }
    }, [sentences, currentIndex]);

    const audioUrl = `https://tatoeba.org/audio/download/${sentences[currentIndex]?.audios[0].id}`;
    const player = useAudioPlayer(audioUrl);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View>
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

            </View>

            {sentences.length > 0 && (
                <View style={styles.exerciseContainer}>

                    <View style={styles.navigation}>
                        <Button
                            title="Previous"
                            onPress={() => navigateSentence('prev')}
                            disabled={currentIndex === 0}
                        />
                        <Text style={styles.tracker}>
                            {currentIndex + 1} / {sentences.length}
                        </Text>
                        <Button
                            title="Next"
                            onPress={() => navigateSentence('next')}
                            disabled={currentIndex === sentences.length - 1}
                        />
                    </View>


                    <View style={styles.audioContainer}>
                        <TouchableOpacity
                            style={[styles.button]}
                            onPress={() => player.play()}
                        >
                            <Text style={styles.buttonText}>Play Audio</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => setShowTranslation(!showTranslation)}
                        >
                            <Text style={styles.buttonText}>{showTranslation ? "Hide Translation" : "Show Translation"}</Text>
                        </TouchableOpacity>

                        {showTranslation && (
                            <Text style={styles.translationText}>{sentences[currentIndex].translations[0][0]?.text}</Text>
                        )}
                    </View>

                    <TextInput
                        ref={(input) => { this.userInput = input; }}
                        style={[styles.input, styles.userInput]}
                        placeholder="Type your best"
                        value={userInputText}
                        onChangeText={setUserInputText}
                        editable={!submitted}
                        onSubmitEditing={handleEnterPress}
                        returnKeyType={submitted ? 'next' : 'done'}
                        blurOnSubmit={false}
                        autoCorrect={false}
                        autoComplete='off'
                    />

                    {!submitted ? (
                        <Button title="Submit" onPress={handleSubmit} />
                    ) : (
                        <View style={styles.resultContainer}>
                            <Text style={styles.resultHeading}>Correct Sentence:</Text>
                            <View style={styles.correctSentence}>
                                {differences.filter(part => !part.removed).map((part, i) => (
                                    <Text
                                        key={i}
                                        style={part.added ? styles.addedText : styles.normalText}
                                    >
                                        {part.value}
                                    </Text>
                                ))}
                            </View>
                            <Button
                                title="Go To Next Sentence"
                                onPress={() => navigateSentence('next')}
                                disabled={currentIndex === sentences.length - 1}
                            />
                        </View>
                    )}
                </View>
            )}

            <View style={styles.creditsContainer}>
                <Text style={styles.creditsText}>
                    Developed by{' '}
                    <Text
                        style={styles.linkText}
                        onPress={() => Linking.openURL('https://www.linkedin.com/in/furkanunluturk')}
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
                    .{' '}
                    Please consider contributing or donating to Tatoeba if you find this tool helpful.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    languageSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24, // Increased margin to create more space
    },
    tracker: {
        fontSize: 16,
        textAlign: 'center',
        color: '#666',
    },
    audioContainer: {
        marginBottom: 20,
        alignItems: 'center',
    },
    button: {
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        marginTop: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
    },
    buttonSpacing: {
        marginBottom: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20, // Increased margin for better separation from other elements
        fontSize: 16,
    },
    userInput: {
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
    translationText: {
        fontSize: 18,
        marginTop: 10,
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
    correctSentence: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20, // Ensure spacing below for any subsequent components
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
        marginBottom: 10,
        alignItems: 'center', // Center align text/buttons
    },
    creditsContainer: {
        marginTop: 24, // Increased margin for more spacing
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0', // Light gray border
        alignItems: 'center',
    },
    creditsText: {
        fontSize: 14,
        color: '#7F8C8D',
        lineHeight: 20,
        textAlign: 'center', // Center the text for readability
    },
    linkText: {
        color: '#4A90E2', // Primary blue
        textDecorationLine: 'underline',
    },
});