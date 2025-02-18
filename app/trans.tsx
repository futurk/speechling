import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView } from 'react-native';

type LanguageCode = keyof typeof LANGUAGES;
// ISO 639-3 language codes
const LANGUAGES = {
    deu: 'German',
    eng: 'English',
    fra: 'French',
    spa: 'Spanish',
    ita: 'Italian',
    jpn: 'Japanese',
    tur: 'Turkish',
    rus: 'Russian',
    ara: 'Arabic',
    cmn: 'Chinese (Mandarin)',
    por: 'Portuguese',
    hun: 'Hungarian',
    heb: 'Hebrew',
    nld: 'Dutch',
    ukr: 'Ukrainian',
    pol: 'Polish',
    vie: 'Vietnamese',
    kor: 'Korean'
};

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

    const differences = submitted ? diff.diffWords(userTranslation, correctTranslation) : [];

    const handleEnterPress = () => {
        if (!submitted) {
            handleSubmit();
        } else {
            navigateSentence('next');
        }
    };

    // Add useEffect to automatically focus on the input when moving to next sentence
    useEffect(() => {
        if (submitted && currentIndex < sentences.length - 1) {
            // Automatically focus on the input when moving to next sentence
            this.translationInput.focus();
        }
    }, [currentIndex, submitted]);


    return (
        <ScrollView contentContainerStyle={styles.container}>

            {/* Language Selectors */}
            <View style={styles.languageSelector}>
                <Picker
                    selectedValue={targetLang}
                    style={styles.picker}
                    onValueChange={(value: LanguageCode) =>
                        setTargetLang(value)
                    }
                >
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                        <Picker.Item
                            key={code}
                            label={`Target: ${name}`}
                            value={code}
                        />
                    ))}
                </Picker>

                <Picker
                    selectedValue={nativeLang}
                    style={styles.picker}
                    onValueChange={(value: LanguageCode) =>
                        setNativeLang(value)
                    }
                >
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                        <Picker.Item
                            key={code}
                            label={`Native: ${name}`}
                            value={code}
                        />
                    ))}
                </Picker>
            </View>


            <Button
                title={loading ? 'Loading...' : 'Load Sentences'}
                onPress={fetchSentences}
                disabled={loading}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {sentences.length > 0 && (
                <View style={styles.exerciseContainer}>
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