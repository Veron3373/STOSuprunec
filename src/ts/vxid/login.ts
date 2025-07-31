// src/js/login.ts
import { supabase } from "./supabaseClient";

// 🚪 Вхід через Google
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "https://veron3373.github.io/STOSuprunec/",
    },
  });

  if (error) {
    console.error("Помилка входу:", error);
  } else {
    console.log("✅ Вхід через Google ініційовано");
  }
}

// 🔍 Перевірка дозволеного доступу
supabase.auth.onAuthStateChange(async (_event, session) => {
  const user = session?.user;

  if (user) {
    try {
      const { data: whitelist, error } = await supabase
        .from("whitelist")
        .select("email")
        .eq("email", user.email);

      if (error) {
        console.error("Помилка при перевірці whitelist:", error);
        return;
      }

      if (whitelist && whitelist.length > 0) {
        window.location.href = "/STOSuprunec/main.html"; // <-- ключовий момент
      } else {
        alert("Ваш email не дозволено для входу.");
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error("Помилка доступу до whitelist:", err);
    }
  }
});

// 🧠 Прив’язка до кнопки
document.addEventListener("DOMContentLoaded", () => {
  const loginButton = document.getElementById("login");
  if (loginButton) {
    loginButton.addEventListener("click", () => {
      signInWithGoogle();
    });
  }
});
