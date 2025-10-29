import React from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView
} from "react-native";
import Toast from "react-native-toast-message";
import { useAuth } from "src/providers/AuthProvider";

const COMMON_PASSWORDS = new Set([
  "password","123456","123456789","qwerty","12345678","111111","123123","abc123","password1"
]);

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}
function validatePasswordBasic(pw: string) {
  const okLen = typeof pw === "string" && pw.length >= 8;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const noSpaces = !/\s/.test(pw);
  const notCommon = !COMMON_PASSWORDS.has(String(pw || "").toLowerCase());
  return okLen && hasLetter && hasNumber && noSpaces && notCommon;
}

export default function AccountScreen() {
  const { user, updateEmail, changePassword, deleteAccount } = useAuth();

  const [email, setEmail] = React.useState(user?.email ?? "");
  const [savingEmail, setSavingEmail] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | undefined>(undefined);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [pwErrors, setPwErrors] = React.useState<{ current?: string; new?: string; confirm?: string }>({});
  const [changingPw, setChangingPw] = React.useState(false);

  const [deleting, setDeleting] = React.useState(false);

  const trimmedEmail = normalizeEmail(email);
  const emailChanged = (user?.email ?? "").toLowerCase() !== trimmedEmail;

  function validateEmailField() {
    if (!trimmedEmail) {
      setEmailError("Email is required.");
      return false;
    }
    if (!isValidEmail(trimmedEmail)) {
      setEmailError("Enter a valid email.");
      return false;
    }
    if (!emailChanged) {
      setEmailError("Email is unchanged.");
      return false;
    }
    setEmailError(undefined);
    return true;
  }

  async function onSaveEmail() {
    if (!validateEmailField()) return;
    try {
      setSavingEmail(true);
      await updateEmail(trimmedEmail);
      Toast.show({ type: "success", text1: "Email updated. Check your inbox to verify." });
    } catch (e: any) {
      Toast.show({ type: "error", text1: e?.message || "Failed to update email" });
    } finally {
      setSavingEmail(false);
    }
  }

  function validatePasswordFields() {
    const next: typeof pwErrors = {};

    if (!currentPassword) next.current = "Current password is required.";

    if (!newPassword) next.new = "New password is required.";
    else {
      if (!validatePasswordBasic(newPassword)) {
        next.new = "Use 8+ chars, include letters & numbers, no spaces, avoid common passwords.";
      } else if (newPassword === currentPassword) {
        next.new = "New password must be different from current password.";
      }
    }

    if (!confirmPassword) next.confirm = "Please confirm your new password.";
    else if (confirmPassword !== newPassword) next.confirm = "Passwords do not match.";

    setPwErrors(next);
    return Object.keys(next).length === 0;
  }

  const emailDisabled = !emailChanged || !!emailError || savingEmail;

  const pwDisabled =
    changingPw ||
    !currentPassword ||
    !newPassword ||
    !confirmPassword ||
    !validatePasswordBasic(newPassword) ||
    newPassword === currentPassword ||
    confirmPassword !== newPassword;

  async function onChangePassword() {
    if (!validatePasswordFields()) return;
    try {
      setChangingPw(true);
      await changePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setPwErrors({});
      Toast.show({ type: "success", text1: "Password updated" });
    } catch (e: any) {
      Toast.show({ type: "error", text1: e?.message || "Failed to change password" });
    } finally {
      setChangingPw(false);
    }
  }

  function confirmAsync({
    title,
    message,
    okText = "OK",
    cancelText = "Cancel",
    destructive = false,
  }: {
    title: string;
    message: string;
    okText?: string;
    cancelText?: string;
    destructive?: boolean;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      if (Platform.OS === "web") {
        const ok = window.confirm(`${title}\n\n${message}`);
        return resolve(ok);
      }
      Alert.alert(
        title,
        message,
        [
          { text: cancelText, style: "cancel", onPress: () => resolve(false) },
          { text: okText, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });
  }

  async function confirmDelete() {
    const ok = await confirmAsync({
      title: "Delete account",
      message: "This will permanently delete your account and notes. This action cannot be undone.",
      okText: "Delete",
      cancelText: "Cancel",
      destructive: true,
    });
    if (ok) await onDelete();
  }

  async function onDelete() {
    try {
      setDeleting(true);
      await deleteAccount();
    } catch (e: any) {
      Toast.show({ type: "error", text1: e?.message || "Failed to delete account" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
      <ScrollView contentContainerClassName="p-4 gap-6">
        <View className="bg-white dark:bg-neutral-900 rounded-2xl p-4 shadow">
          <Text className="text-xl font-semibold mb-2">Account</Text>
          <Text className="text-neutral-600 dark:text-neutral-300">
            User ID: <Text className="font-mono">{user?.id || "—"}</Text>
          </Text>
        </View>

        <View className="bg-white dark:bg-neutral-900 rounded-2xl p-4 shadow gap-3">
          <Text className="text-lg font-semibold">Email</Text>
          <TextInput
            id="email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (emailError) setEmailError(undefined);
            }}
            onBlur={validateEmailField}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            className={`border rounded-xl px-3 py-2 text-base ${
              emailError ? "border-red-500 dark:border-red-500" : "border-neutral-300 dark:border-neutral-700"
            }`}
          />
          {!!emailError && <Text className="text-xs text-red-500">{emailError}</Text>}
          <TouchableOpacity
            disabled={emailDisabled}
            onPress={onSaveEmail}
            className={`rounded-xl px-4 py-3 items-center ${
              !emailDisabled ? "bg-blue-600" : "bg-neutral-300 dark:bg-neutral-700"
            }`}
          >
            {savingEmail ? <ActivityIndicator /> : <Text className="text-white font-semibold">Save Email</Text>}
          </TouchableOpacity>
          <Text className="text-xs text-neutral-500">
            You may need to re-verify your email depending on server policy.
          </Text>
        </View>

        <View className="bg-white dark:bg-neutral-900 rounded-2xl p-4 shadow gap-3">
          <Text className="text-lg font-semibold">Change Password</Text>

          <Text className="text-sm text-neutral-600 dark:text-neutral-300">Current Password</Text>
          <TextInput
            id="password-current"
            value={currentPassword}
            onChangeText={(t) => {
              setCurrentPassword(t);
              if (pwErrors.current) setPwErrors({ ...pwErrors, current: undefined });
            }}
            secureTextEntry
            placeholder="Current password"
            className={`border rounded-xl px-3 py-2 text-base ${
              pwErrors.current ? "border-red-500 dark:border-red-500" : "border-neutral-300 dark:border-neutral-700"
            }`}
            onBlur={validatePasswordFields}
          />
          {!!pwErrors.current && <Text className="text-xs text-red-500">{pwErrors.current}</Text>}

          <Text className="text-sm text-neutral-600 dark:text-neutral-300">New Password</Text>
          <TextInput
            id="password-new"
            value={newPassword}
            onChangeText={(t) => {
              setNewPassword(t);
              if (pwErrors.new) setPwErrors({ ...pwErrors, new: undefined });
            }}
            secureTextEntry
            placeholder="New password"
            className={`border rounded-xl px-3 py-2 text-base ${
              pwErrors.new ? "border-red-500 dark:border-red-500" : "border-neutral-300 dark:border-neutral-700"
            }`}
            onBlur={validatePasswordFields}
          />
          {!!pwErrors.new && <Text className="text-xs text-red-500">{pwErrors.new}</Text>}

          <Text className="text-sm text-neutral-600 dark:text-neutral-300">Confirm New Password</Text>
          <TextInput
            id="password-confirm"
            value={confirmPassword}
            onChangeText={(t) => {
              setConfirmPassword(t);
              if (pwErrors.confirm) setPwErrors({ ...pwErrors, confirm: undefined });
            }}
            secureTextEntry
            placeholder="Confirm new password"
            className={`border rounded-xl px-3 py-2 text-base ${
              pwErrors.confirm ? "border-red-500 dark:border-red-500" : "border-neutral-300 dark:border-neutral-700"
            }`}
            onBlur={validatePasswordFields}
          />
          {!!pwErrors.confirm && <Text className="text-xs text-red-500">{pwErrors.confirm}</Text>}

          <TouchableOpacity
            onPress={onChangePassword}
            disabled={pwDisabled}
            className={`rounded-xl px-4 py-3 items-center ${
              pwDisabled ? "bg-neutral-300 dark:bg-neutral-700" : "bg-emerald-600"
            }`}
          >
            {changingPw ? <ActivityIndicator /> : <Text className="text-white font-semibold">Update Password</Text>}
          </TouchableOpacity>

          <Text className="text-xs text-neutral-500">
            Must be 8+ chars, include letters and numbers, no spaces, and not a common password.
          </Text>
        </View>

        <View className="bg-white dark:bg-neutral-900 rounded-2xl p-4 shadow gap-3">
          <Text className="text-lg font-semibold text-red-700">Danger Zone</Text>
          <Text className="text-sm text-neutral-600 dark:text-neutral-300">
            Deleting your account is permanent and cannot be undone.
          </Text>

          <TouchableOpacity
            onPress={confirmDelete}
            disabled={deleting}
            className={`rounded-xl px-4 py-3 items-center ${
              deleting ? "bg-neutral-300 dark:bg-neutral-700" : "bg-red-600"
            }`}
          >
            {deleting ? <ActivityIndicator /> : <Text className="text-white font-semibold">Delete Account</Text>}
          </TouchableOpacity>
        </View>

        <View className="h-8" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
