// LanguageSelector.tsx
import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { View, StyleSheet } from 'react-native';

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

interface LanguageSelectorProps {
    selectedValue: LanguageCode;
    onValueChange: (value: LanguageCode) => void;
    label: string;
}

export type LanguageCode = keyof typeof LANGUAGES;

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
    selectedValue,
    onValueChange,
    label,
}) => (
    <Picker
        selectedValue={selectedValue}
        style={styles.picker}
        onValueChange={onValueChange}
    >
        {Object.entries(LANGUAGES).map(([code, name]) => (
            <Picker.Item key={code} label={`${label}: ${name}`} value={code} />
        ))}
    </Picker>
);

const styles = StyleSheet.create({
    picker: {
        height: 50,
        width: '48%',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
});

export default LanguageSelector;