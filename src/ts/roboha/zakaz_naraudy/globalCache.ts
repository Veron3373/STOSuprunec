// globalCache.ts - Глобальні дані та кеш

import { supabase } from "../../vxid/supabaseClient";
import { showNotification } from "./inhi/vspluvauhe_povadomlenna";
import { safeParseJSON } from "./inhi/ctvorennia_papku_googleDrive.";

/**
 * Глобальні змінні для кешування даних
 */
export interface GlobalDataCache {
  works: string[];
  details: string[];
  slyusars: Array<{ Name: string; [key: string]: any }>;
  shops: Array<{ Name: string; [key: string]: any }>;
  settings: { showPibMagazin: boolean };
  isActClosed: boolean;
  currentActId: number | null;
}

export const globalCache: GlobalDataCache = {
  works: [],
  details: [],
  slyusars: [],
  shops: [],
  settings: { showPibMagazin: true },
  isActClosed: false,
  currentActId: null,
};

/**
 * Константи для ID елементів
 */
export const ZAKAZ_NARAYD_MODAL_ID = "zakaz_narayd-custom-modal";
export const ZAKAZ_NARAYD_BODY_ID = "zakaz_narayd-body";
export const ZAKAZ_NARAYD_CLOSE_BTN_ID = "zakaz_narayd-close";
export const ZAKAZ_NARAYD_SAVE_BTN_ID = "save-act-data";
export const EDITABLE_PROBIG_ID = "editable-probig";
export const EDITABLE_REASON_ID = "editable-reason";
export const EDITABLE_RECOMMENDATIONS_ID = "editable-recommendations"; // ДОДАНО
export const OPEN_GOOGLE_DRIVE_FOLDER_ID = "open-google-drive-folder";
export const ACT_ITEMS_TABLE_CONTAINER_ID = "act-items-table-container";

/**
 * Допоміжна функція для форматування числа з пробілами для розділення тисяч.
 * Використовує Intl.NumberFormat для коректного форматування з локаллю 'uk-UA'.
 * @param value Число для форматування.
 * @param minimumFractionDigits Мінімальна кількість знаків після коми (за замовчуванням 0).
 * @param maximumFractionDigits Максимальна кількість знаків після коми (за замовчуванням 2).
 * @returns Стрічка з відформатованим числом або порожня стрічка, якщо вхідне значення не є числом.
 */
export function formatNumberWithSpaces(
  value: number | string | undefined | null,
  minimumFractionDigits: number = 0,
  maximumFractionDigits: number = 2
): string {
  if (value === undefined || value === null || String(value).trim() === "") {
    return "";
  }
  const num = parseFloat(String(value).replace(",", "."));
  if (isNaN(num)) {
    return String(value); // Повертаємо оригінальне значення, якщо не можемо перетворити на число
  }
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: minimumFractionDigits,
    maximumFractionDigits: maximumFractionDigits,
  }).format(num);
}

/**
 * Завантажує всі необхідні дані в глобальні змінні
 */
export async function loadGlobalData(): Promise<void> {
  try {
    const [
      { data: worksData },
      { data: detailsData },
      { data: slyusarsData },
      { data: shopsData },
    ] = await Promise.all([
      supabase.from("works").select("data"),
      supabase.from("details").select("data"),
      supabase.from("slyusars").select("data"),
      supabase.from("shops").select("data"),
    ]);

    const { data: settingsData, error: settingsError } = await supabase
      .from("settings")
      .select("data")
      .eq("setting_id", 1) // ← потрібне ID
      .single();

    if (settingsError) {
      console.warn(
        "⚠️ Не вдалося отримати налаштування 'settings':",
        settingsError.message
      );
    }

    globalCache.works =
      worksData?.map((row: any) => row.data || "").filter(Boolean) || [];

    globalCache.details =
      detailsData?.map((row: any) => row.data || "").filter(Boolean) || [];

    globalCache.slyusars =
      slyusarsData
        ?.map((row: any) => {
          const parsedData = safeParseJSON(row.data);
          return parsedData?.Name ? parsedData : null;
        })
        .filter(Boolean) || [];

    globalCache.shops =
      shopsData
        ?.map((row: any) => {
          const parsedData = safeParseJSON(row.data);
          return parsedData?.Name ? parsedData : null;
        })
        .filter(Boolean) || [];

    // ✅ ОНОВЛЕНИЙ блок — враховує поле `data: boolean`
    globalCache.settings = {
      showPibMagazin: settingsData?.data === true,
    };
  } catch (error) {
    console.error("❌ Помилка завантаження глобальних даних:", error);
    showNotification("Помилка завантаження базових даних", "error");
  }
}