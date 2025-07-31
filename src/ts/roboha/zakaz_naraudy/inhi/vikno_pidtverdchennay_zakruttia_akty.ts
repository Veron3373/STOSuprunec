// vikno_pidtverdchennay_zakruttia_akty.ts - Модуль для модального вікна підтвердження закриття акту

export const viknoPidtverdchennayZakruttiaAktyId = "vikno_pidtverdchennay_zakruttia_akty-modal";

// Створення модального вікна
export function createViknoPidtverdchennayZakruttiaAkty(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.id = viknoPidtverdchennayZakruttiaAktyId;
  overlay.className = "vikno_pidtverdchennay_zakruttia_akty-overlay";
  overlay.style.display = "none";

  const modal = document.createElement("div");
  modal.className = "vikno_pidtverdchennay_zakruttia_akty-content";

  modal.innerHTML = `
    <p>Підтвердіть закриття акту?</p>
    <div class="vikno_pidtverdchennay_zakruttia_akty-buttons save-buttons">
      <button id="vikno_pidtverdchennay_zakruttia_akty-confirm" class="vikno_pidtverdchennay_zakruttia_akty-confirm-btn btn-save-confirm">Так</button>
      <button id="vikno_pidtverdchennay_zakruttia_akty-cancel" class="vikno_pidtverdchennay_zakruttia_akty-cancel-btn btn-save-cancel">Ні</button>
    </div>`;
    
  overlay.appendChild(modal);
  return overlay;
}

// Показ модального вікна
export function showViknoPidtverdchennayZakruttiaAkty(actId: number): Promise<boolean> {
  console.log("Закриття акту ID:", actId); // або покажи в модалці
  return new Promise((resolve) => {
    const modal = document.getElementById(viknoPidtverdchennayZakruttiaAktyId);
    if (!modal) {
      console.error(`Модальне вікно з ID "${viknoPidtverdchennayZakruttiaAktyId}" не знайдено.`);
      return resolve(false);
    }

    modal.style.display = "flex";

    const confirmBtn = document.getElementById("vikno_pidtverdchennay_zakruttia_akty-confirm") as HTMLButtonElement;
    const cancelBtn = document.getElementById("vikno_pidtverdchennay_zakruttia_akty-cancel") as HTMLButtonElement;

    // Перевірка, чи знайдені кнопки
    if (!confirmBtn || !cancelBtn) {
      console.error("Кнопки підтвердження або скасування не знайдені в модальному вікні.");
      modal.style.display = "none"; // Закриваємо модалку, якщо кнопки відсутні
      return resolve(false);
    }

    const cleanup = () => {
      modal.style.display = "none";
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
  });
}