import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index" // This corresponds to the file name `index.tsx`
        options={{
          title: "Speechling", // Set the desired title for the header
        }}
      />
    </Stack>
  );
}