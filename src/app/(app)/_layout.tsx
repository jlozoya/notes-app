import { Stack } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { TouchableOpacity, Text } from "react-native";

export default function AppLayout() {
  const { signOut } = useAuth();
  return (
    <Stack>
      <Stack.Screen
        name="notes/index"
        options={{
          title: "Notes",
          headerRight: () => (
            <TouchableOpacity className="px-3 py-1" onPress={signOut}>
              <Text className="font-medium">Sign out</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="notes/[id]"
        options={{ title: "Edit note" }}
      />
    </Stack>
  );
}
