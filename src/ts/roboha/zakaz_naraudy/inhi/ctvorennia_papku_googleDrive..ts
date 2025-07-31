// googleDrive.ts - Об'єднаний модуль для роботи з Google Drive

import { supabase } from '../../../vxid/supabaseClient';
import { showNotification } from './vspluvauhe_povadomlenna';

// Оголошення глобальних змінних
declare let gapi: any;
declare let google: any;

// --- КОНФІГУРАЦІЯ ---
const CLIENT_ID = "467665595953-63b13ucmm8ssbm2vfjjr41e3nqt6f11a.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

const ALLOWED_ORIGINS = [
  'https://veron3373.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

let accessToken: string | null = null; // Зберігає токен доступу Google Drive

// --- ТИПИ ДАНИХ ---
/**
 * Інтерфейс для повної інформації про акт, що використовується для створення папок.
 */
interface ActFullInfo {
  act_id: number;
  date_on: string;
  fio: string;
  phone: string;
  car: string;
  year: string;
  act_data: any; // Додаткові дані акту, як вони зберігаються в БД
}

// --- УТИЛІТНІ ФУНКЦІЇ ---

/**
 * Нормалізує помилку до об'єкта Error.
 * @param error - Вихідна помилка (може бути будь-якого типу).
 * @returns Об'єкт Error.
 */
function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  return new Error('Невідома помилка');
}

/**
 * Перевіряє, чи поточний домен дозволено для інтеграції з Google Drive.
 * @returns true, якщо домен дозволено, інакше false.
 */
function isAllowedOrigin(): boolean {
  const currentOrigin = window.location.origin;
  return ALLOWED_ORIGINS.includes(currentOrigin);
}

/**
 * Безпечно парсить JSON-рядок.
 * @param data - Дані, які потрібно розпарсити.
 * @returns Розпарсені дані або null, якщо парсинг не вдався.
 */
export function safeParseJSON(data: any): any {
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
 * Очищає компонент назви, видаляючи спеціальні символи та нормалізуючи пробіли.
 * @param component - Компонент назви (наприклад, ім'я клієнта, назва авто).
 * @returns Очищений рядок.
 */
function cleanNameComponent(component: string): string {
  // Видаляємо спеціальні символи, залишаючи літери, цифри, пробіли, крапки та тире.
  // Використовуємо \p{L} для будь-яких літер Unicode, \p{N} для будь-яких цифр Unicode.
  return component
    .replace(/[^\p{L}\p{N}\s.-]/gu, '') // Видаляємо символи, що не є літерами, цифрами, пробілами, крапками, тире
    .replace(/\s+/g, '_')           // Замінюємо послідовні пробіли на одинарне підкреслення
    .replace(/_{2,}/g, '_')         // Замінюємо множинні підкреслення на одинарні
    .replace(/^_|_$/g, '');         // Видаляємо підкреслення з початку та кінця
}

// --- ЗАВАНТАЖЕННЯ ТА ІНІЦІАЛІЗАЦІЯ GOOGLE API ---

/**
 * Завантажує скрипти Google API (GIS та GAPI).
 * @returns Promise, який вирішується після завантаження скриптів або відхиляється у разі помилки.
 */
async function loadGoogleAPIScripts(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Перевіряємо, чи API вже завантажені
    if (typeof google !== 'undefined' && typeof gapi !== 'undefined') {
      resolve();
      return;
    }

    const gisScript = document.createElement("script");
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.async = true;
    gisScript.defer = true;

    gisScript.onload = () => {
      const gapiScript = document.createElement("script");
      gapiScript.src = "https://apis.google.com/js/api.js";
      gapiScript.async = true;
      gapiScript.defer = true;

      gapiScript.onload = () => resolve();
      gapiScript.onerror = () => reject(new Error("Не вдалося завантажити GAPI скрипт."));

      document.head.appendChild(gapiScript);
    };

    gisScript.onerror = () => reject(new Error("Не вдалося завантажити Google Identity Services скрипт."));
    document.head.appendChild(gisScript);
  });
}

/**
 * Ініціалізує Google API та аутентифікує користувача.
 * Викликає запит на отримання токена доступу.
 * @returns Promise, який вирішується після успішної ініціалізації та аутентифікації.
 * @throws Error, якщо ініціалізація або аутентифікація не вдалася.
 */
export async function initGoogleApi(): Promise<void> {
  try {
    if (!isAllowedOrigin()) {
      throw new Error(`Домен ${window.location.origin} не дозволено для використання Google Drive.`);
    }

    await loadGoogleAPIScripts();

    // Завантаження клієнтської бібліотеки GAPI
    await new Promise<void>((resolve, reject) => {
      gapi.load('client', {
        callback: resolve,
        onerror: () => reject(new Error('Помилка завантаження клієнтської бібліотеки GAPI.'))
      });
    });

    // Ініціалізація та запит токена доступу
    return new Promise<void>((resolve, reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response: any) => {
          if (response.error || !response.access_token) {
            return reject(new Error(response.error || 'Не вдалося отримати токен доступу Google Drive.'));
          }

          accessToken = response.access_token;
          gapi.client.setToken(response);

          try {
            await gapi.client.init({}); // Ініціалізація gapi.client без API-ключа, якщо він не потрібен
            await gapi.client.load('drive', 'v3'); // Завантаження Drive API v3
            await testDriveConnection(); // Перевірка з'єднання
            resolve();
          } catch (err) {
            reject(normalizeError(err));
          }
        },
        error_callback: (err: any) => reject(normalizeError(err))
      });

      tokenClient.requestAccessToken();
    });
  } catch (error) {
    throw normalizeError(error);
  }
}

// --- РОБОТА З GOOGLE DRIVE API ---

/**
 * Виконує HTTP-запит до Google Drive API.
 * @param endpoint - Шлях до ресурсу API (наприклад, '/files').
 * @param options - Додаткові опції для fetch-запиту.
 * @returns Promise з результатом запиту.
 * @throws Error, якщо токен доступу відсутній або запит не вдався.
 */
// ... (попередній код)

async function callDriveAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
  if (!accessToken) {
    console.error('Спроба викликати Drive API без токена доступу.');
    throw new Error('Відсутній токен доступу для Google Drive. Будь ласка, авторизуйтесь.');
  }

  // Динамічно будуємо заголовки
  const requestHeaders: HeadersInit = { // Використовуємо тип HeadersInit для кращої типізації
    'Authorization': `Bearer ${accessToken}`,
    ...(options.headers as Record<string, string>), // Розповсюджуємо існуючі заголовки, переконуємося, що вони сумісні
  };

  // Умовно додаємо Content-Type для запитів, відмінних від GET
  if (options.method !== 'GET' && options.method !== undefined) { // Також перевіряємо на undefined метод
    requestHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3${endpoint}`, {
    ...options,
    headers: requestHeaders, // Використовуємо динамічно створені заголовки
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Помилка Drive API ${response.status}: ${response.statusText}`, errorBody);
    throw new Error(`Помилка Google Drive API: ${response.status} ${response.statusText}. Деталі: ${errorBody.substring(0, 200)}`);
  }

  if (response.headers.get("content-type")?.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

/**
 * Шукає папку за назвою в заданій батьківській папці.
 * @param name - Назва папки для пошуку.
 * @param parentId - ID батьківської папки (за замовчуванням 'root' - коренева папка).
 * @returns ID папки, якщо знайдено, інакше null.
 */
async function findFolder(name: string, parentId: string | null = null): Promise<string | null> {
  try {
    // Екранування одинарних лапок у назві папки для коректного QL-запиту
    const escapedName = name.replace(/'/g, "\\'");
    const query = `'${parentId ?? 'root'}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const list = await callDriveAPI(`/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);

    return list.files?.[0]?.id || null;
  } catch (e) {
    console.error(`Помилка пошуку папки '${name}':`, e);
    return null; // Повертаємо null, щоб не блокувати створення
  }
}

/**
 * Створює нову папку в Google Drive.
 * @param name - Назва нової папки.
 * @param parentId - ID батьківської папки (необов'язково).
 * @returns ID створеної папки.
 * @throws Error, якщо створення не вдалося.
 */
async function createFolder(name: string, parentId: string | null = null): Promise<string> {
  try {
    const folderMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId && { parents: [parentId] }) // Додаємо батьківську папку, якщо вона є
    };

    const createResult = await callDriveAPI('/files?fields=id', {
      method: 'POST',
      body: JSON.stringify(folderMetadata),
    });

    if (!createResult?.id) {
      throw new Error(`Не вдалося отримати ID нової папки '${name}'.`);
    }
    return createResult.id;
  } catch (e) {
    throw normalizeError(e);
  }
}

/**
 * Знаходить або створює папку в Google Drive.
 * @param name - Назва папки.
 * @param parentId - ID батьківської папки (необов'язково).
 * @returns ID знайденої або створеної папки.
 * @throws Error, якщо операція не вдалася.
 */
export async function findOrCreateFolder(name: string, parentId: string | null = null): Promise<string> {
  try {
    console.log(`Пошук або створення папки: '${name}' в батьківській папці ID: ${parentId || 'root'}`);
    const existingFolderId = await findFolder(name, parentId);

    if (existingFolderId) {
      console.log(`Знайдено існуючу папку: '${name}' з ID: ${existingFolderId}`);
      return existingFolderId;
    }

    console.log(`Папку '${name}' не знайдено. Створюємо нову.`);
    return await createFolder(name, parentId);
  } catch (e) {
    throw normalizeError(e);
  }
}

// --- РОБОТА З БАЗОЮ ДАНИХ (SUPABASE) ---

/**
 * Отримує повну інформацію про акт, включаючи дані клієнта та авто.
 * @param actId - ID акту.
 * @returns Об'єкт ActFullInfo.
 * @throws Error, якщо акт не знайдено або виникла помилка БД.
 */
async function getActFullInfo(actId: number): Promise<ActFullInfo> {
  try {
    const { data: act, error: actError } = await supabase
      .from('acts')
      .select('*')
      .eq('act_id', actId)
      .single();

    if (actError || !act) {
      throw new Error(`Не вдалося знайти акт з ID ${actId}: ${actError?.message || 'дані відсутні'}`);
    }

    let clientInfo = { fio: "Невідомий_клієнт", phone: "Без_телефону" };
    if (act.client_id) {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('client_id', act.client_id)
        .single();

      if (!clientError && client) {
        // Парсинг даних клієнта з різних можливих структур
        const clientRawData = client.data || client;
        const clientParsedData = safeParseJSON(clientRawData.data || clientRawData);

        const fio = clientParsedData?.["ПІБ"] || clientParsedData?.fio || clientRawData?.fio || client.fio || "Невідомий_клієнт";
        const phone = clientParsedData?.["Телефон"] || clientParsedData?.phone || clientRawData?.phone || client.phone || "Без_телефону";

        clientInfo = {
          fio: String(fio).trim() || "Невідомий_клієнт",
          phone: String(phone).trim() || "Без_телефону"
        };
      }
    }

    let carInfo = { auto: "Невідоме_авто", year: "0000" };
    if (act.cars_id) {
      const { data: car, error: carError } = await supabase
        .from('cars')
        .select('*')
        .eq('cars_id', act.cars_id)
        .single();

      if (!carError && car) {
        // Парсинг даних авто з різних можливих структур
        const carRawData = car.data || car;
        const carParsedData = safeParseJSON(carRawData.data || carRawData);

        const auto = carParsedData?.["Авто"] || carParsedData?.auto || carRawData?.auto || car.auto || "Невідоме_авто";
        const year = carParsedData?.["Рік"] || carParsedData?.year || carRawData?.year || car.year || "0000";

        carInfo = {
          auto: String(auto).trim() || "Невідоме_авто",
          year: String(year).trim() || "0000"
        };
      }
    }

    return {
      act_id: actId,
      date_on: act.date_on,
      fio: clientInfo.fio,
      phone: clientInfo.phone,
      car: carInfo.auto,
      year: carInfo.year,
      act_data: act // Повертаємо оригінальні дані акту для інших потреб
    };

  } catch (error) {
    console.error('Помилка отримання повної інформації про акт:', error);
    throw normalizeError(error);
  }
}

/**
 * Оновлює посилання на папку Google Drive в даних акту в базі даних.
 * @param actId - ID акту.
 * @param driveUrl - URL папки Google Drive.
 * @returns Promise, який вирішується після успішного оновлення.
 * @throws Error, якщо оновлення не вдалося.
 */
async function updateActPhotoLink(actId: number, driveUrl: string): Promise<void> {
  try {
    console.log(`Оновлення посилання для акту ${actId}: ${driveUrl}`);

    // Отримуємо поточний запис акту, щоб не перезаписати інші поля 'data'
    const { data: currentAct, error: fetchError } = await supabase
      .from('acts')
      .select('data')
      .eq('act_id', actId)
      .single();

    if (fetchError) {
      throw new Error(`Не вдалося отримати акт з ID ${actId} для оновлення посилання: ${fetchError.message}`);
    }
    if (!currentAct) {
      throw new Error(`Акт з ID ${actId} не знайдено для оновлення посилання.`);
    }

    // Парсимо поточні дані або ініціалізуємо порожній об'єкт, якщо 'data' null
    const actData = safeParseJSON(currentAct.data) || {};

    // Оновлюємо або додаємо посилання на папку з фото
    actData.Фото = [driveUrl];

    const { error: updateError } = await supabase
      .from('acts')
      .update({ data: actData })
      .eq('act_id', actId);

    if (updateError) {
      throw new Error(`Помилка оновлення посилання для акту ${actId}: ${updateError.message}`);
    }

    console.log(`Посилання на папку для акту ${actId} успішно оновлено.`);

  } catch (error) {
    console.error('Критична помилка при оновленні посилання на папку в БД:', error);
    throw normalizeError(error);
  }
}

// --- УПРАВЛІННЯ UI (ОНОВЛЕННЯ МОДАЛЬНОГО ВІКНА) ---

/**
 * Оновлює візуальний блок посилань на фото в модальному вікні.
 * @param photoLinks - Масив URL-адрес фотографій.
 * @param isActClosed - Чи закритий акт (впливає на можливість створення папки).
 */
export function updatePhotoSection(photoLinks: string[], isActClosed: boolean = false): void {
  const photoCell = document.querySelector('table.zakaz_narayd-table.left tr:nth-child(5) td:nth-child(2)');
  if (!photoCell) {
    console.warn('Не знайдено елемент для оновлення секції фото.');
    return;
  }

  const hasLinks = photoLinks.length > 0 && photoLinks[0];
  photoCell.innerHTML = `
    <span id="open-google-drive-folder" 
          style="cursor: pointer; text-decoration: underline; color: ${hasLinks ? 'green' : 'red'};">
      ${hasLinks ? 'Відкрити архів фото' : 'Створити фото Google'}
    </span>
  `;

  // Додаємо обробник подій після оновлення DOM
  addGoogleDriveHandler(isActClosed);
}

/**
 * Додає обробник подій для кнопки "Відкрити/Створити папку Google Drive".
 * Логіка розділена на відкриття існуючої папки та створення нової.
 * @param isActClosed - Чи закритий акт (для перевірки дозволу на створення).
 */
export function addGoogleDriveHandler(isActClosed: boolean = false): void {
  const googleDriveButton = document.getElementById("open-google-drive-folder");
  if (!googleDriveButton) {
    console.warn('Кнопка "open-google-drive-folder" не знайдена.');
    return;
  }

  // Запобігаємо подвійному додаванню обробників
  googleDriveButton.removeEventListener("click", handleGoogleDriveClick);
  googleDriveButton.addEventListener("click", handleGoogleDriveClick);

  // Функція-обробник, щоб можна було видалити
  async function handleGoogleDriveClick(e: Event) {
    e.preventDefault();

    const modal = document.getElementById("zakaz_narayd-custom-modal");
    const actId = modal?.getAttribute("data-act-id");

    if (!actId) {
      showNotification("Не вдалося отримати ID акту з модального вікна.", "error");
      return;
    }

    try {
      showNotification("Перевірка статусу фотографій...", "info");

      // Отримуємо актуальні дані по акту, щоб перевірити наявність посилань та статус закриття
      const { data: act, error } = await supabase
        .from("acts")
        .select("data, date_off")
        .eq("act_id", Number(actId))
        .single();

      if (error || !act) {
        showNotification("Помилка отримання даних акту з БД.", "error");
        console.error("Помилка отримання акту для обробника Google Drive:", error);
        return;
      }

      const actData = safeParseJSON(act.data) || {};
      const existingLinks: string[] = Array.isArray(actData?.["Фото"]) ? actData["Фото"] : [];

      // Логіка: Якщо посилання вже є, просто відкриваємо його.
      if (existingLinks.length > 0 && existingLinks[0]) {
        const existingUrl = existingLinks[0];
        showNotification("Відкриваємо існуючу папку Google Drive...", "success");
        window.open(existingUrl, "_blank");
        return;
      }

      // Логіка: Якщо посилання немає, перевіряємо, чи акт закритий.
      const isActCurrentlyClosed = !!act.date_off;
      if (isActCurrentlyClosed || isActClosed) { // isActClosed з параметрів функції також враховується
        showNotification("Акт закритий — неможливо створити нову папку з фотографіями.", "warning");
        return;
      }

      // Якщо посилання немає і акт не закритий - створюємо папку.
      showNotification("Ініціалізація Google Drive та створення папки...", "info");

      await initGoogleApi(); // Ініціалізуємо API та авторизуємося, якщо ще ні

      const actInfo = await getActFullInfo(Number(actId));
      await createDriveFolderStructure(actInfo); // Створюємо структуру папок

      showNotification("Папку Google Drive успішно створено та відкрито!", "success");

    } catch (err) {
      console.error("❌ Google Drive помилка:", err);
      showNotification(`Помилка: Не вдалося створити або відкрити папку. ${normalizeError(err).message}`, "error");
    }
  }
}

/**
 * Оновлює дані про фотографії в модальному вікні, отримуючи їх з бази даних.
 * @param actId - ID акту.
 */
export async function refreshPhotoData(actId: number): Promise<void> {
  try {
    const { data: act, error } = await supabase
      .from("acts")
      .select("data, date_off")
      .eq("act_id", actId)
      .single();

    if (error || !act) {
      console.error("Помилка при оновленні даних фото для UI:", error);
      return;
    }

    const actData = safeParseJSON(act.data) || {};
    const photoLinks: string[] = Array.isArray(actData?.["Фото"])
      ? actData["Фото"]
      : [];

    const isActClosed = !!act.date_off;
    updatePhotoSection(photoLinks, isActClosed);
  } catch (error) {
    console.error("Загальна помилка при refreshPhotoData:", error);
  }
}

// --- ОСНОВНА ФУНКЦІЯ СТВОРЕННЯ СТРУКТУРИ ПАПОК ---

/**
 * Створює ієрархічну структуру папок в Google Drive (Рік -> Акт) та зберігає посилання в БД.
 * Відкриває створену папку в новому вікні.
 * @param actInfo - Об'єкт з детальною інформацією про акт.
 * @returns Promise, який вирішується після успішного створення та оновлення.
 * @throws Error, якщо виникає помилка під час створення папок або оновлення БД.
 */
export async function createDriveFolderStructure({ act_id, date_on, fio, phone, car, year }: ActFullInfo): Promise<void> {
  try {
    const date = new Date(date_on);
    const yyyy = `${date.getFullYear()}`;

    console.log(`Початок створення структури папок для акту ID: ${act_id}`);

    // Крок 1: Знаходимо або створюємо папку року (наприклад, "2023")
    const yearFolderId = await findOrCreateFolder(yyyy);

    // Крок 2: Формуємо назву папки акту
    const folderNameParts = [
      `Акт_${act_id}`,
      fio && fio !== "—" && fio !== "Невідомий_клієнт" ? cleanNameComponent(fio) : null,
      car && car !== "—" && car !== "Невідоме_авто" ? cleanNameComponent(car) : null,
      year && year !== "—" && year !== "0000" ? cleanNameComponent(year) : null,
      phone && phone !== "—" && phone !== "Без_телефону" ? cleanNameComponent(phone) : null
    ].filter(Boolean); // Видаляємо null/порожні значення

    // Об'єднуємо частини і обрізаємо, щоб назва не була занадто довгою
    const finalFolderName = folderNameParts.join('_').substring(0, 100).trim();
    if (!finalFolderName) {
      throw new Error('Не вдалося сформувати коректну назву папки для акту. Перевірте дані.');
    }

    // Крок 3: Створюємо папку для акту всередині папки року
    const finalFolderId = await createFolder(finalFolderName, yearFolderId);
    console.log(`Папку акту '${finalFolderName}' створено з ID: ${finalFolderId}`);

    // Крок 4: Формуємо URL до створеної папки Google Drive
    const driveUrl = `https://drive.google.com/drive/folders/${finalFolderId}`;
    console.log(`Сформоване посилання на папку Drive: ${driveUrl}`);

    // Крок 5: Оновлюємо базу даних, додаючи посилання на створену папку
    await updateActPhotoLink(act_id, driveUrl);

    // Крок 6: Відкриваємо папку в новому вікні
    console.log(`Відкриваємо папку в новому вікні: ${driveUrl}`);
    window.open(driveUrl, '_blank');

    showNotification('Папка Google Drive успішно створена та посилання збережено.', 'success');
  } catch (e) {
    const error = normalizeError(e);
    console.error('Помилка під час створення структури папок Google Drive:', error);
    showNotification(`Помилка створення папки Google Drive: ${error.message}`, 'error');
    // Можливо, тут варто не робити alert, а покладатися на showNotification
  }
}

// --- УТИЛІТНІ ФУНКЦІЇ ДЛЯ АУТЕНТИФІКАЦІЇ ТА СТАТУСУ ---

/**
 * Перевіряє, чи користувач наразі аутентифікований в Google Drive.
 * @returns true, якщо токен доступу існує, інакше false.
 */
export function checkAuthStatus(): boolean {
  return accessToken !== null;
}

/**
 * Виконує вихід з облікового запису Google.
 * Анулює токен доступу та очищає його.
 */
export async function signOut(): Promise<void> {
  try {
    if (accessToken && google.accounts?.oauth2) {
      google.accounts.oauth2.revoke(accessToken, () => console.log('Токен Google анульовано.'));
    }
    accessToken = null;
    if (gapi.client) {
      gapi.client.setToken(null);
      console.log('Клієнт GAPI очищено.');
    }
    showNotification('Вихід з Google Drive успішний.', 'info');
  } catch (e) {
    console.error('Помилка при виході з Google Drive:', e);
    showNotification('Помилка при виході з Google Drive.', 'error');
  }
}

/**
 * Тестує з'єднання з Google Drive API, виконуючи простий запит.
 * @throws Error, якщо з'єднання не вдалося.
 */
export async function testDriveConnection(): Promise<void> {
  try {
    await callDriveAPI('/files?pageSize=1&fields=files(id)');
    console.log('Тестове з\'єднання з Google Drive успішне.');
  } catch (e) {
    throw normalizeError(e); // Перекидаємо нормалізовану помилку далі
  }
}

/**
 * Отримує інформацію про поточного аутентифікованого користувача Google.
 * @returns Об'єкт з інформацією про користувача.
 * @throws Error, якщо не вдалося отримати інформацію.
 */
export async function getCurrentUser(): Promise<any> {
  try {
    const res = await callDriveAPI('/about?fields=user');
    return res.user;
  } catch (e) {
    throw normalizeError(e);
  }
}