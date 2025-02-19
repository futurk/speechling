import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView } from 'react-native';
import { LanguageSelector, LanguageCode } from './components/LanguageSelector';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tatoeba.org/en/api_v0/search';
const diff = require('diff');

export default function App() {
    const [nativeLang, setNativeLang] = useState<LanguageCode>('tur');
    const [targetLang, setTargetLang] = useState<LanguageCode>('eng');
    const [sentences, setSentences] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userTranslation, setUserTranslation] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [correctTranslation, setCorrectTranslation] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchSentences = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/search?from=${nativeLang}&to=${targetLang}&original=no&sort=random`);
            const data = await response.json();

            if (data.results?.length > 0) {
                const validSentences = data.results.filter(
                    sentence => sentence.translations[0]?.length > 0
                );

                if (validSentences.length === 0) {
                    setError('No translations found for selected languages');
                } else {
                    setSentences(validSentences);
                    setCurrentIndex(0);
                    setCorrectTranslation(validSentences[0].translations[0][0].text);
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

    const navigateSentence = (direction) => {
        const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (newIndex >= 0 && newIndex < sentences.length) {
            setCurrentIndex(newIndex);
            setSubmitted(false);
            setUserTranslation('');
            setCorrectTranslation(sentences[newIndex].translations[0][0].text);
        }
    };

    const handleEnterPress = () => {
        if (!submitted) {
            handleSubmit();
        } else {
            navigateSentence('next');
        }
    };

    const differences = submitted ? diff.diffWords(userTranslation, correctTranslation) : [];

    // automatically focus on the input
    useEffect(() => {
        if (currentIndex < sentences.length - 1) {
            this.translationInput.focus();
        }
    }, [sentences, currentIndex]);

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

                    <Text style={styles.sentence}>{sentences[currentIndex].text}</Text>

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