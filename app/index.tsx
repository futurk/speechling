import { Stack, useRouter } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function Index() {
    const router = useRouter();

    const navigateToListen = () => {
        router.push('/listen'); // Navigate to listen.tsx
    };

    const navigateToTrans = () => {
        router.push('/trans'); // Navigate to trans.tsx
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome to Listen2Bea</Text>
            <TouchableOpacity style={styles.button} onPress={navigateToListen}>
                <Text style={styles.buttonText}>Freeplay Mode</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={navigateToTrans}>
                <Text style={styles.buttonText}>Dictation Practice</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F8F9FA',
    },
    title: {
        fontSize: 24,
        marginBottom: 20,
        color: '#2C3E50',
    },
    button: {
        backgroundColor: '#4A90E2',
        padding: 16,
        borderRadius: 8,
        marginVertical: 10,
        width: '80%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
});