// /src/ts/roboha/tablucya/tablucya.ts

import { supabase } from "../../vxid/supabaseClient";
import { showModal } from "../zakaz_naraudy/modalMain";


// =============================================================================
// КОНСТАНТИ ТА ГЛОБАЛЬНІ ЗМІННІ
// =============================================================================

const HEADERS: string[] = [
  "№ акту",
  "Дата",
  "Клієнт 🔽",
  "Автомобіль",
  "Сумма",
];

let actsGlobal: any[] = [];
let clientsGlobal: any[] = [];
let carsGlobal: any[] = [];
let sortByDateStep = 0;

// =============================================================================
// УТИЛІТИ ДЛЯ РОБОТИ З ДАНИМИ
// =============================================================================

/**
 * Безпечне парсування JSON
 */
function safeParseJSON(data: any): any {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data;
}

/**
 * Форматування дати у DD.MM.YYYY
 */
function formatDate(date: Date): string {
  return `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}.${date.getFullYear()}`;
}

/**
 * Валідація формату дати DD.MM.YYYY
 */
function validateDateFormat(dateStr: string): boolean {
  const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
  if (!dateRegex.test(dateStr)) return false;

  const [d, m, y] = dateStr.split(".");
  const day = parseInt(d);
  const month = parseInt(m);
  const year = parseInt(y);

  return (
    day >= 1 &&
    day <= 31 &&
    month >= 1 &&
    month <= 12 &&
    year >= 2000 &&
    year <= 2100
  );
}

// =============================================================================
// ОБРОБКА ДАНИХ АКТІВ
// =============================================================================

/**
 * Отримання інформації про клієнта
 */
function getClientInfo(act: any, clients: any[]): string {
  const client = clients?.find((c) => c.client_id === act.client_id);
  const clientData = safeParseJSON(client?.data);

  const pib = clientData?.["ПІБ"] || "Невідомо";
  let phone = clientData?.["Телефон"] || "";

  // Видалення дужок, дефісів та пробілів з номера телефону
  phone = phone.replace(/[\(\)\-\s]/g, '');

  return phone ? `${pib} ${phone}` : pib;
}

/**
 * Отримання інформації про авто
 */
function getCarInfo(act: any, cars: any[]): string {
  const car = cars?.find((c) => c.cars_id === act.cars_id);
  const carData = safeParseJSON(car?.data);

  const номерАвто = carData?.["Номер авто"] || "";
  const назваАвто = carData?.["Авто"] || "";

  return `${номерАвто} ${назваАвто}`.trim();
}

/**
 * Отримання суми з акту
 */
function getActAmount(act: any): string {
  const actData = safeParseJSON(act.info || act.data || act.details);

  const rawAmount =
    actData?.["Загальна сума"] ||
    actData?.["total"] ||
    actData?.["amount"] ||
    act.total ||
    act.amount;

  if (rawAmount === undefined) return "0 грн";

  const num = Number(rawAmount);
  return isNaN(num) ? "0 грн" : `${num.toLocaleString("uk-UA")} грн`;
}

/**
 * Отримання дати з акту
 */
function getActDate(act: any): string {
  if (!act.date_on) return "-";

  const d = new Date(act.date_on);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");

  return `<div class="phone-blue-italic">${hours}:${minutes}</div><div>${day}.${month}.${year}</div>`;
}

/**
 * Перевірка чи акт закритий
 */
function isActClosed(act: any): boolean {
  return act.date_off && !isNaN(Date.parse(act.date_off));
}

// =============================================================================
// РЕНДЕРИНГ ТАБЛИЦІ
// =============================================================================

/**
 * Створення комірки телефону
 */
function createClientCell(
  clientInfo: string,
  actId: number
): HTMLTableCellElement {
  const td = document.createElement("td");

  // Отримуємо всі телефони з clientInfo (будь-який формат +380 і далі цифри, дужки, пробіли, дефіси)
  // Цей рядок тепер шукає номери без дужок та дефісів, оскільки вони були видалені раніше
  const phones = [...clientInfo.matchAll(/\+380\d{9,}/g)].map(
    (m) => m[0]
  );

  // Видаляємо всі телефони з тексту ПІБ
  let pibOnly = clientInfo;
  phones.forEach((p) => {
    pibOnly = pibOnly.replace(p, "").trim();
  });

  // Додаємо ПІБ першим рядком
  td.innerHTML = `<div>${pibOnly}</div>`;

  // Додаємо кожен телефон окремим рядком з синім курсивом
  phones.forEach((p) => {
    td.innerHTML += `<div class="phone-blue-italic">${p}</div>`;
  });

  td.addEventListener("click", () => showModal(actId));
  return td;
}

/**
 * Створення комірки з авто
 */
function createCarCell(carInfo: string, actId: number): HTMLTableCellElement {
  const td = document.createElement("td");

  const parts = carInfo.split(" ");
  const номер = parts[0] || "";
  const назва = parts.slice(1).join(" ") || "";

  td.innerHTML = `<div>${номер}</div>${
    назва ? `<div><span class="car-red-bold">${назва}</span></div>` : ""
  }`;

  td.addEventListener("dblclick", () => showModal(actId)); // для авто і стандартної

  return td;
}

/**
 * Створення стандартної комірки
 */
function createStandardCell(
  content: string,
  actId: number
): HTMLTableCellElement {
  const td = document.createElement("td");
  td.innerHTML = content; // 👈 дозволяємо HTML
  td.addEventListener("dblclick", () => showModal(actId)); // для авто і стандартної

  return td;
}

/**
 * Рендеринг рядків таблиці
 */
function renderActsRows(
  acts: any[],
  clients: any[],
  cars: any[],
  tbody: HTMLTableSectionElement
): void {
  tbody.innerHTML = "";

  acts.forEach((act) => {
    const isClosed = isActClosed(act);
    const lockIcon = isClosed ? "🔒" : "🗝️";

    const cellsData = [
      `${lockIcon} ${act.act_id?.toString() || "N/A"}`,
      getActDate(act),
      getClientInfo(act, clients),
      getCarInfo(act, cars),
      getActAmount(act),
    ];

    const row = document.createElement("tr");
    row.classList.add(isClosed ? "row-closed" : "row-open");

    cellsData.forEach((cellData, i) => {
      let td: HTMLTableCellElement;

      if (HEADERS[i].includes("Клієнт")) {
        td = createClientCell(cellData, act.act_id);
      } else if (HEADERS[i] === "Автомобіль") {
        td = createCarCell(cellData, act.act_id);
      } else {
        td = createStandardCell(cellData, act.act_id);
      }

      row.appendChild(td);
    });

    tbody.appendChild(row);
  });
}

// =============================================================================
// СОРТУВАННЯ
// =============================================================================

/**
 * Сортування актів
 */
function sortActs(): void {
  if (sortByDateStep === 0) {
    // Сортування за статусом (відкриті зверху)
    actsGlobal.sort((a, b) => {
      const aOpen = !isActClosed(a);
      const bOpen = !isActClosed(b);
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;
      return 0;
    });
    sortByDateStep = 1;
  } else {
    // Сортування за датою (новіші зверху)
    actsGlobal.sort(
      (a, b) => new Date(b.date_on).getTime() - new Date(a.date_on).getTime()
    );
    sortByDateStep = 0;
  }
}

// =============================================================================
// РОБОТА З ДАТАМИ
// =============================================================================

/**
 * Отримання діапазону дат за замовчуванням (останній місяць)
 */
function getDefaultDateRange(): string {
  const today = new Date();
  const lastMonth = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    today.getDate()
  );

  return `${formatDate(lastMonth)} - ${formatDate(today)}`;
}

/**
 * Валідація та отримання діапазону дат
 */
function getDateRange(): { dateFrom: string; dateTo: string } | null {
  const input = document.getElementById("dateRangePicker") as HTMLInputElement;
  const dateRangeValue = input?.value?.trim();

  // Встановлення значення за замовчуванням
  if (!dateRangeValue) {
    console.warn(
      "⚠️ Діапазон дат порожній. Завантажуємо всі акти за останній місяць."
    );
    input.value = getDefaultDateRange();
  }

  const currentValue = input.value.trim();

  // Якщо поточне значення - "Відкриті", то це не помилка
  if (currentValue === "Відкриті") {
    return null; // Повертаємо null, щоб викликати окрему логіку для "Відкритих"
  }

  // Перевірка формату діапазону
  if (!currentValue.includes(" - ")) {
    console.error(
      "❌ Невірний формат діапазону. Очікується: DD.MM.YYYY - DD.MM.YYYY"
    );
    return null;
  }

  const [startStr, endStr] = currentValue.split(" - ");

  // Валідація формату дат
  if (!validateDateFormat(startStr) || !validateDateFormat(endStr)) {
    console.error("❌ Невірний формат дати. Використовуйте DD.MM.YYYY");
    return null;
  }

  // Конвертація у формат YYYY-MM-DD HH:mm:ss
  try {
    const [dateFrom, dateTo] = [startStr, endStr].map((str, i) => {
      const [d, m, y] = str.split(".");
      const full = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      return i === 0 ? `${full} 00:00:00` : `${full} 23:59:59`;
    });

    return { dateFrom, dateTo };
  } catch (error) {
    console.error("❌ Помилка конвертації дати:", error);
    return null;
  }
}

// =============================================================================
// ЗАВАНТАЖЕННЯ ДАНИХ
// =============================================================================

/**
 * Завантаження актів з бази даних
 * @param dateFrom - Початкова дата для фільтрації (YYYY-MM-DD HH:mm:ss)
 * @param dateTo - Кінцева дата для фільтрації (YYYY-MM-DD HH:mm:ss)
 * @param filterType - Тип фільтрації: "open" для відкритих актів, null для діапазону дат
 * @returns Масив актів або null у разі помилки
 */
async function loadActsFromDB(
  dateFrom: string | null,
  dateTo: string | null,
  filterType: "open" | null = null
): Promise<any[] | null> {
  let query = supabase.from("acts").select("*");

  if (filterType === "open") {
    query = query.is("date_off", null);
  } else if (dateFrom && dateTo) {
    query = query.gte("date_on", dateFrom).lte("date_on", dateTo);
  } else {
    // Якщо немає ні дат, ні фільтра "open", завантажуємо акти за останній місяць за замовчуванням
    console.warn(
      "⚠️ loadActsFromDB викликано без фільтрів. Завантажуємо акти за останній місяць."
    );
    const fallbackDates = getDateRange(); // Отримати діапазон за замовчуванням
    if (fallbackDates) {
      query = supabase
        .from("acts")
        .select("*")
        .gte("date_on", fallbackDates.dateFrom)
        .lte("date_on", fallbackDates.dateTo);
    } else {
      return []; // Якщо навіть за замовчуванням не вдалося отримати дати
    }
  }

  query = query.order("act_id", { ascending: false });

  const { data: acts, error: actsError } = await query;

  if (actsError) {
    console.error("❌ Помилка при отриманні актів:", actsError);
    return null;
  }

  return acts || [];
}

/**
 * Завантаження клієнтів з бази даних
 */
async function loadClientsFromDB(): Promise<any[] | null> {
  const { data: clients, error: clientError } = await supabase
    .from("clients")
    .select("client_id, data");

  if (clientError) {
    console.error("❌ Помилка при отриманні клієнтів:", clientError);
    return null;
  }

  return clients || [];
}

/**
 * Завантаження авто з бази даних
 */
async function loadCarsFromDB(): Promise<any[] | null> {
  const { data: cars, error: carsError } = await supabase
    .from("cars")
    .select("cars_id, data");

  if (carsError) {
    console.error("❌ Помилка при отриманні авто:", carsError);
    return null;
  }

  return cars || [];
}

// =============================================================================
// СТВОРЕННЯ ТАБЛИЦІ
// =============================================================================

/**
 * Створення заголовку таблиці
 */
function createTableHeader(): HTMLTableSectionElement {
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  HEADERS.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;

    th.addEventListener("click", () => {
      if (header === "Клієнт 🔽") {
        sortActs();
        updateTableBody();
      }
    });

    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  return thead;
}

/**
 * Оновлення тіла таблиці
 */
function updateTableBody(): void {
  const table = document.querySelector(
    "#table-container-modal-sakaz_narad table"
  );
  if (!table) return;

  const newTbody = document.createElement("tbody");
  renderActsRows(actsGlobal, clientsGlobal, carsGlobal, newTbody);

  const oldTbody = table.querySelector("tbody");
  if (oldTbody) oldTbody.replaceWith(newTbody);
}

/**
 * Створення повної таблиці
 */
function createTable(): HTMLTableElement {
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";

  const thead = createTableHeader();
  const tbody = document.createElement("tbody");

  renderActsRows(actsGlobal, clientsGlobal, carsGlobal, tbody);

  table.appendChild(thead);
  table.appendChild(tbody);

  return table;
}

/**
 * Відображення повідомлення про відсутність даних
 */
function showNoDataMessage(message: string): void {
  // Змінено на динамічне повідомлення
  const container = document.getElementById(
    "table-container-modal-sakaz_narad"
  );
  if (container) {
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #666;">
      ${message}
    </div>`;
  }
}

// =============================================================================
// ОСНОВНІ ФУНКЦІОНАЛЬНІ
// =============================================================================

/**
 * Завантаження та відображення таблиці актів
 * @param dateFrom - Початкова дата для фільтрації (YYYY-MM-DD HH:mm:ss)
 * @param dateTo - Кінцева дата для фільтрації (YYYY-MM-DD HH:mm:ss)
 * @param filterType - Тип фільтрації: "open" для відкритих актів, null для діапазону дат
 * @param searchTerm - Термін пошуку для фільтрації по клієнтах/авто
 */
export async function loadActsTable(
  dateFrom?: string | null,
  dateTo?: string | null,
  filterType?: "open" | null,
  searchTerm?: string | null // Додано searchTerm
): Promise<void> {
  try {
    let finalDateFrom: string | null = null;
    let finalDateTo: string | null = null;
    let finalFilterType: "open" | null = filterType || null;
    const lowerCaseSearchTerm = searchTerm ? searchTerm.toLowerCase() : null;

    // Якщо filterType не 'open', тоді намагаємося отримати дати
    if (finalFilterType !== "open") {
      if (dateFrom && dateTo) {
        finalDateFrom = dateFrom;
        finalDateTo = dateTo;
      } else {
        // Якщо немає переданих параметрів дат, беремо з input
        const fallback = getDateRange();
        if (fallback) {
          finalDateFrom = fallback.dateFrom;
          finalDateTo = fallback.dateTo;
        } else if ($("#dateRangePicker").val() === "Відкриті") {
          // Якщо input показує 'Відкриті', встановлюємо filterType
          finalFilterType = "open";
        } else {
          // Якщо не вдалося визначити діапазон дат і не "Відкриті",
          // тоді завантажуємо за замовчуванням (останній місяць)
          const defaultRange = getDefaultDateRange();
          const [startStr, endStr] = defaultRange.split(" - ");
          const [d1, m1, y1] = startStr.split(".");
          const [d2, m2, y2] = endStr.split(".");
          finalDateFrom = `${y1}-${m1.padStart(2, "0")}-${d1.padStart(
            2,
            "0"
          )} 00:00:00`;
          finalDateTo = `${y2}-${m2.padStart(2, "0")}-${d2.padStart(
            2,
            "0"
          )} 23:59:59`;
          // Оновлюємо поле вводу, щоб воно відображало цей діапазон
          $("#dateRangePicker").val(defaultRange);
        }
      }
    }

    // Завантаження даних
    const [acts, clients, cars] = await Promise.all([
      loadActsFromDB(finalDateFrom, finalDateTo, finalFilterType),
      loadClientsFromDB(),
      loadCarsFromDB(),
    ]);

    if (acts === null || clients === null || cars === null) {
      return; // Помилки вже оброблені у відповідних функціях
    }

    // Збереження даних глобально
    clientsGlobal = clients;
    carsGlobal = cars;

    let filteredActs = acts;

    // Застосування фільтрації за терміном пошуку
    if (lowerCaseSearchTerm) {
      filteredActs = acts.filter(act => {
        const clientInfo = getClientInfo(act, clients);
        const carInfo = getCarInfo(act, cars);

        return (
          clientInfo.toLowerCase().includes(lowerCaseSearchTerm) ||
          carInfo.toLowerCase().includes(lowerCaseSearchTerm)
        );
      });
    }

    actsGlobal = filteredActs; // Оновлюємо actsGlobal відфільтрованими актами

    // Перевірка наявності актів після фільтрації
    if (actsGlobal.length === 0) {
      console.warn("⚠️ Немає актів у вказаному діапазоні дат або за терміном пошуку.");
      let message = "Немає актів";
      if (finalFilterType === "open") {
        message += " (відкритих)";
      } else {
        const input = document.getElementById(
          "dateRangePicker"
        ) as HTMLInputElement;
        message += ` у діапазоні дат: ${input?.value || "невідомий"}`;
      }
      if (lowerCaseSearchTerm) {
        message += ` за запитом "${searchTerm}"`;
      }
      showNoDataMessage(message);
      return;
    }

    // Створення та відображення таблиці
    const table = createTable();
    const container = document.getElementById(
      "table-container-modal-sakaz_narad"
    );

    if (container) {
      container.innerHTML = "";
      container.appendChild(table);
    } else {
      console.error(
        "❌ Контейнер table-container-modal-sakaz_narad не знайдено."
      );
    }
  } catch (error) {
    console.error("💥 Критична помилка:", error);
  }
}

/**
 * Примусове оновлення таблиці
 */
export function refreshActsTable(): void {
  // refreshActsTable тепер має викликати loadActsTable без параметрів,
  // і loadActsTable сама визначить поточний стан (дати або "Відкриті")
  // А також збереже поточний термін пошуку
  const searchInput = document.getElementById("searchInput") as HTMLInputElement;
  const currentSearchTerm = searchInput?.value?.trim() || '';

  const dateRangePicker = document.getElementById("dateRangePicker") as HTMLInputElement;
  const currentValue = dateRangePicker.value.trim();

  let currentFilterType: "open" | null = null;
  let currentDateFrom: string | null = null;
  let currentDateTo: string | null = null;

  if (currentValue === "Відкриті") {
    currentFilterType = "open";
  } else {
    const dates = getDateRange();
    if (dates) {
      currentDateFrom = dates.dateFrom;
      currentDateTo = dates.dateTo;
    }
  }

  loadActsTable(currentDateFrom, currentDateTo, currentFilterType, currentSearchTerm);
}

// =============================================================================
// ВІДСТЕЖЕННЯ ЗМІН
// =============================================================================

/**
 * Відстеження змін у dateRangePicker
 */
function watchDateRangeChanges(): void {
  const dateRangePicker = document.getElementById(
    "dateRangePicker"
  ) as HTMLInputElement;
  if (!dateRangePicker) return;

  let lastValue = dateRangePicker.value;

  const observer = new MutationObserver(() => {
    const currentValue = dateRangePicker.value;
    if (currentValue !== lastValue) {
      lastValue = currentValue;
      // При зміні значення поля, викликаємо loadActsTable без параметрів,
      // щоб вона сама визначила, чи це дати, чи "Відкриті"
      // Також передаємо поточний термін пошуку
      const searchInput = document.getElementById("searchInput") as HTMLInputElement;
      const currentSearchTerm = searchInput?.value?.trim() || '';
      loadActsTable(undefined, undefined, undefined, currentSearchTerm);
    }
  });

  observer.observe(dateRangePicker, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });

  window.addEventListener("beforeunload", () => {
    observer.disconnect();
  });
}

// =============================================================================
// ІНІЦІАЛІЗАЦІЯ
// =============================================================================

/**
 * Ініціалізація модулю таблиці актів
 */
export function initializeActsTable(): void {
  loadActsTable(); // Завантажити таблицю при ініціалізації (визначить діапазон або "Відкриті")
  watchDateRangeChanges(); // Запустити відстеження змін дати
}

// Стало:
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    initializeActsTable();
  } else {
    console.warn("⛔ Користувач не авторизований. Таблиця не завантажена.");
  }
});
