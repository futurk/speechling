import { Stack } from "expo-router";
import { useEffect } from "react";

export default function RootLayout() {
  const title = "Listen2Bea: practice listening comprehension on the way";

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: title,
        }}
      />
      <Stack.Screen
        name="listen"
        options={{
          title: "Listen2Bea: Freeplay Mode",
        }}
      />
      <Stack.Screen
        name="trans"
        options={{
          title: "Listen2Bea: Dictation Practice",
        }}
      />
    </Stack>
  );
}