// pbrobnuk_zberechennya_zmin_y_danux_aktu.ts - Обробник збереження змін у даних акту

import { supabase } from "../../../vxid/supabaseClient";
import { showNotification } from "./vspluvauhe_povadomlenna";
import { 
  globalCache, 
  ZAKAZ_NARAYD_SAVE_BTN_ID, 
  EDITABLE_PROBIG_ID, 
  EDITABLE_REASON_ID,
  EDITABLE_RECOMMENDATIONS_ID,
  ACT_ITEMS_TABLE_CONTAINER_ID 
} from "../globalCache";
import { updateCalculatedSumsInFooter } from "../modalUI";
import { refreshActsTable } from "../../tablucya/tablucya";

/**
 * Обробник збереження змін у даних акту
 */
export function addSaveHandler(actId: number, originalActData: any): void {
  const saveButton = document.getElementById(ZAKAZ_NARAYD_SAVE_BTN_ID);
  if (saveButton) {
    // Видаляємо існуючий обробник для уникнення дублювання
    const newSaveButton = saveButton.cloneNode(true) as HTMLButtonElement;
    saveButton.parentNode?.replaceChild(newSaveButton, saveButton);

    newSaveButton.addEventListener("click", async () => {
      if (globalCache.isActClosed) {
        showNotification("Неможливо редагувати закритий акт", "warning");
        return;
      }

      // Отримуємо оновлені значення пробігу, причини та рекомендацій
      const newProbigElement = document.getElementById(EDITABLE_PROBIG_ID);
      const newProbig =
        newProbigElement?.textContent?.trim().replace(/\s/g, "") || "";
      const newReason =
        document.getElementById(EDITABLE_REASON_ID)?.textContent?.trim() || "";
      const newRecommendations =
        document
          .getElementById(EDITABLE_RECOMMENDATIONS_ID)
          ?.textContent?.trim() || "";

      const tableRows = document.querySelectorAll(
        `#${ACT_ITEMS_TABLE_CONTAINER_ID} tbody tr`
      );
      const details: any[] = [];
      const works: any[] = [];

      let totalDetailsSum = 0;
      let totalWorksSum = 0;

      tableRows.forEach((row: Element) => {
        const nameCell = row.querySelector('[data-name="name"]') as HTMLElement;
        const quantityCell = row.querySelector(
          '[data-name="id_count"]'
        ) as HTMLElement;
        const priceCell = row.querySelector(
          '[data-name="price"]'
        ) as HTMLElement;
        const sumCell = row.querySelector('[data-name="sum"]') as HTMLElement;
        const pibMagazinCell = globalCache.settings.showPibMagazin
          ? (row.querySelector('[data-name="pib_magazin"]') as HTMLElement)
          : null;

        const name = nameCell?.textContent?.trim() || "";
        const quantity = parseFloat(
          quantityCell?.textContent?.replace(/\s/g, "").replace(",", ".") || "0"
        );
        const price = parseFloat(
          priceCell?.textContent?.replace(/\s/g, "").replace(",", ".") || "0"
        );
        const sum = parseFloat(
          sumCell?.textContent?.replace(/\s/g, "").replace(",", ".") || "0"
        );
        const pibMagazin = pibMagazinCell?.textContent?.trim() || "";

        if (
          !name &&
          quantity === 0 &&
          price === 0 &&
          sum === 0 &&
          !pibMagazin
        ) {
          return; // Пропускаємо порожні рядки
        }

        const item = {
          Кількість: quantity,
          Ціна: price,
          Сума: sum,
        };

        const currentDataType = nameCell.getAttribute("data-type");

        if (
          currentDataType === "details" ||
          globalCache.details.includes(name)
        ) {
          details.push({
            ...item,
            Деталь: name,
            Магазин: pibMagazin,
          });
          totalDetailsSum += sum;
        } else if (
          currentDataType === "works" ||
          globalCache.works.includes(name)
        ) {
          works.push({
            ...item,
            Робота: name,
            Слюсар: pibMagazin,
          });
          totalWorksSum += sum;
        } else {
          // За замовчуванням додаємо до деталей
          details.push({
            ...item,
            Деталь: name,
            Магазин: pibMagazin,
          });
          totalDetailsSum += sum;
        }
      });

      const grandTotalSum = totalDetailsSum + totalWorksSum;

      const updatedActData = {
        ...(originalActData || {}),
        Пробіг: newProbig,
        "Причина звернення": newReason,
        Рекомендації: newRecommendations,
        Деталі: details,
        Роботи: works,
        "За деталі": totalDetailsSum,
        "За роботу": totalWorksSum,
        "Загальна сума": grandTotalSum,
      };

      try {
        showNotification("Збереження змін...", "info");

        // Оновлюємо поле 'data' акту в базі даних
        const { error: updateError } = await supabase
          .from("acts")
          .update({ data: updatedActData })
          .eq("act_id", actId);

        if (updateError) {
          showNotification(
            "Помилка збереження: " + updateError.message,
            "error"
          );
          return;
        }

        showNotification("Зміни успішно збережено", "success");
        updateCalculatedSumsInFooter();
        refreshActsTable();
      } catch (error) {
        showNotification("Помилка збереження даних", "error");
        console.error("Помилка збереження:", error);
      }
    });
  }
}