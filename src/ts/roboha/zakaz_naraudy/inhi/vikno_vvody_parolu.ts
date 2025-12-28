// vikno_vvody_parolu.ts - Модуль для модального вікна вводу пароля
import { showNotification } from "./vspluvauhe_povadomlenna"; // Шлях до вашої функції сповіщень

export const viknoVvodyParoluId = "vikno_vvody_parolu-modal";

export function createViknoVvodyParolu(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.id = viknoVvodyParoluId;
  overlay.className = "vikno_vvody_parolu-overlay"; // Можете використати ті ж стилі, що й для інших модалок
  overlay.style.display = "none";

  const modal = document.createElement("div");
  modal.className = "vikno_vvody_parolu-content modal-content-save"; // Перевикористовуємо існуючі стилі контенту
  modal.innerHTML = `
    <p>Введіть пароль для відкриття акту:</p>
    <input type="password" id="password-input" placeholder="Пароль" class="password-input" style="padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 8px; width: calc(100% - 20px);">
    <div class="vikno_vvody_parolu-buttons save-buttons">
      <button id="password-confirm-btn" class="btn-save-confirm">Підтвердити</button>
      <button id="password-cancel-btn" class="btn-save-cancel">Скасувати</button>
    </div>
  `;

  overlay.appendChild(modal);
  return overlay;
}

/**
 * Показує модальне вікно для вводу пароля.
 * @returns Promise<boolean> true, якщо пароль введено правильно, false в іншому випадку.
 */
export function showViknoVvodyParolu(): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = document.getElementById(viknoVvodyParoluId);
    if (!modal) {
      console.error(`Модальне вікно вводу пароля з ID "${viknoVvodyParoluId}" не знайдено.`);
      return resolve(false);
    }

    modal.style.display = "flex";

    const passwordInput = document.getElementById("password-input") as HTMLInputElement;
    const confirmBtn = document.getElementById("password-confirm-btn") as HTMLButtonElement;
    const cancelBtn = document.getElementById("password-cancel-btn") as HTMLButtonElement;

    // Очищаємо поле вводу перед кожним показом
    passwordInput.value = "";
    passwordInput.focus(); // Фокус на поле вводу

    const cleanup = () => {
      modal.style.display = "none";
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      passwordInput.removeEventListener("keypress", onKeyPress);
    };

    const onConfirm = () => {
      const enteredPassword = passwordInput.value;
      const correctPassword = "1111"; // Ваш пароль
      if (enteredPassword === correctPassword) {
        showNotification("Пароль вірний", "success", 1000);
        cleanup();
        resolve(true);
      } else {
        showNotification("Невірний пароль", "error", 1500);
        passwordInput.value = ""; // Очищаємо поле при невірному паролі
        passwordInput.focus();
        // Залишаємо модалку відкритою, щоб користувач міг спробувати ще раз
      }
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        onConfirm(); // Викликаємо підтвердження при натисканні Enter
      }
    };

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    passwordInput.addEventListener("keypress", onKeyPress);
  });
}