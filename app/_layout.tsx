import { Stack } from "expo-router";
import { useState, useEffect } from "react";

export default function RootLayout() {
  const title = "Listen2Bea: practice your listening comprehension everyday";

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
    </Stack>
  );
}