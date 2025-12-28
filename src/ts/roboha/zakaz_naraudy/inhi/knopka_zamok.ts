// knopka_zamok.ts - Логіка кнопки замка для відкриття/закриття актів

import { supabase } from "../../../vxid/supabaseClient";
import { showNotification } from "../inhi/vspluvauhe_povadomlenna";
import { showViknoVvodyParolu } from "../inhi/vikno_vvody_parolu";
import { showViknoPidtverdchennayZakruttiaAkty } from "../inhi/vikno_pidtverdchennay_zakruttia_akty";
import { globalCache } from "../globalCache";
import { refreshActsTable } from "../../tablucya/tablucya";
import { showModal } from "../modalMain";

/**
 * Функція для форматування локальної дати та часу у формат 'YYYY-MM-DD HH:MM:SS'
 * для збереження в базі даних з колонкою 'timestamp without time zone'.
 */
function formatLocalDateTimeForDB(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Додає обробник для кнопки статусу замка (відкриття/закриття акту)
 */
export function addStatusLockHandler(actId: number): void {
  const statusLockBtn = document.getElementById("status-lock-btn");

  if (statusLockBtn) {
    statusLockBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Якщо акт вже закритий, показуємо повідомлення про ввід пароля
      if (globalCache.isActClosed) {
        showNotification(
          "Акт закрито. Для відкриття введіть пароль.",
          "info",
          2000
        );
        const passwordCorrect = await showViknoVvodyParolu();

        if (passwordCorrect) {
          try {
            showNotification("Відкриття акту...", "info");

            // Оновлюємо акт у базі даних, скидаючи дату закриття (date_off = null)
            const { error: updateError } = await supabase
              .from("acts")
              .update({
                date_off: null,
              })
              .eq("act_id", actId);

            if (updateError) {
              showNotification(
                "Помилка відкриття акту: " + updateError.message,
                "error"
              );
              return;
            }

            // Оновлюємо глобальний кеш
            globalCache.isActClosed = false;

            showNotification("Акт успішно відкрито", "success", 2000);

            // Перезавантажуємо модальне вікно для відображення оновленого стану
            setTimeout(() => {
              showModal(actId);
            }, 500);

            // Оновлення головної таблиці
            refreshActsTable();
          } catch (error) {
            console.error("Помилка при відкритті акту:", error);
            showNotification("Критична помилка при відкритті акту", "error");
          }
        } else {
          showNotification(
            "Операцію відмінено або пароль невірний.",
            "warning",
            1500
          );
        }
        return;
      }

      // Логіка для ЗАКРИТТЯ акту (якщо він НЕ закритий)
      const isConfirmed = await showViknoPidtverdchennayZakruttiaAkty(actId);

      if (!isConfirmed) {
        return; // Користувач скасував операцію
      }

      try {
        showNotification("Закриття акту...", "info");

        // Оновлюємо акт у базі даних, встановлюючи поточну дату як дату закриття
        const { error: updateError } = await supabase
          .from("acts")
          .update({
            date_off: formatLocalDateTimeForDB(new Date()),
          })
          .eq("act_id", actId);

        if (updateError) {
          showNotification(
            "Помилка закриття акту: " + updateError.message,
            "error"
          );
          return;
        }

        // Оновлюємо глобальний кеш
        globalCache.isActClosed = true;

        showNotification("Акт успішно закрито", "success", 2000);

        // Перезавантажуємо модальне вікно для відображення оновленого стану
        setTimeout(() => {
          showModal(actId);
        }, 500);

        // Оновлення головної таблиці
        refreshActsTable();
      } catch (error) {
        console.error("Помилка при закритті акту:", error);
        showNotification("Критична помилка при закритті акту", "error");
      }
    });
  }
}