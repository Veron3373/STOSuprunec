// googleDrive.ts - Об'єднаний модуль для роботи з Google Drive

import { supabase } from '../../../vxid/supabaseClient';
import { showNotification } from './vspluvauhe_povadomlenna';

// Оголошення глобальних змінних
declare let gapi: any;
declare let google: any;

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

let accessToken: string | null = null;

// ========== УТИЛІТНІ ФУНКЦІЇ ==========

function handleError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  return new Error('Невідома помилка');
}

function isAllowedOrigin(): boolean {
  const currentOrigin = window.location.origin;
  return ALLOWED_ORIGINS.includes(currentOrigin);
}

// Утилітна функція для безпечного парсингу JSON
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

// Функція для очищення окремих компонентів назви
function cleanNameComponent(component: string): string {
  return component
    .replace(/[^\p{L}\p{N}\s.-]/gu, '') // Видаляємо спеціальні символи
    .replace(/\s+/g, '_')               // Заміняємо пробіли на підкреслення
    .replace(/_{2,}/g, '_')             // Заміняємо множинні підкреслення на одинарні
    .replace(/^_|_$/g, '');             // Видаляємо підкреслення з початку та кінця
}


// ========== ЗАВАНТАЖЕННЯ ТА ІНІЦІАЛІЗАЦІЯ API ==========

async function loadGoogleAPIs(): Promise<void> {
  return new Promise((resolve, reject) => {
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
      gapiScript.onerror = () => reject(new Error("Не вдалося завантажити GAPI"));

      document.head.appendChild(gapiScript);
    };

    gisScript.onerror = () => reject(new Error("Не вдалося завантажити Google Identity Services"));
    document.head.appendChild(gisScript);
  });
}

export async function initGoogleApi(): Promise<void> {
  try {
    if (!isAllowedOrigin()) {
      throw new Error(`Домен ${window.location.origin} не дозволено.`);
    }

    await loadGoogleAPIs();

    await new Promise<void>((resolve, reject) => {
      gapi.load('client', {
        callback: resolve,
        onerror: () => reject(new Error('Помилка завантаження GAPI'))
      });
    });

    return new Promise<void>((resolve, reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response: any) => {
          if (response.error || !response.access_token) {
            return reject(new Error(response.error || 'Не отримано токен доступу'));
          }

          accessToken = response.access_token;
          gapi.client.setToken(response);

          try {
            await gapi.client.init({});
            await gapi.client.load('drive', 'v3');
            await testDriveConnection();
            resolve();
          } catch (err) {
            reject(handleError(err));
          }
        },
        error_callback: (err: any) => reject(handleError(err))
      });

      tokenClient.requestAccessToken();
    });
  } catch (error) {
    throw handleError(error);
  }
}

// ========== РОБОТА З DRIVE API ==========

async function callDriveAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
  if (!accessToken) throw new Error('Немає токена доступу');

  const response = await fetch(`https://www.googleapis.com/drive/v3${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Drive API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Функція для пошуку папки за назвою в батьківській папці
async function findFolder(name: string, parentId: string | null = null): Promise<string | null> {
  try {
    const query = `'${parentId ?? 'root'}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const list = await callDriveAPI(`/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);
    
    return list.files?.[0]?.id || null;
  } catch (e) {
    console.error('Помилка пошуку папки:', e);
    return null;
  }
}

// Функція для створення нової папки
async function createFolder(name: string, parentId: string | null = null): Promise<string> {
  try {
    const create = await callDriveAPI('/files?fields=id', {
      method: 'POST',
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined
      })
    });

    return create.id;
  } catch (e) {
    throw handleError(e);
  }
}

// Поліпшена функція для пошуку або створення папки
export async function findOrCreateFolder(name: string, parentId: string | null = null): Promise<string> {
  try {
    // Спочатку шукаємо існуючу папку
    const existingFolderId = await findFolder(name, parentId);
    
    if (existingFolderId) {
      console.log(`Знайдено існуючу папку: ${name}`);
      return existingFolderId;
    }

    // Якщо не знайдено, створюємо нову
    console.log(`Створюємо нову папку: ${name}`);
    return await createFolder(name, parentId);
  } catch (e) {
    throw handleError(e);
  }
}

// ========== РОБОТА З БАЗОЮ ДАНИХ ==========

// Функція для отримання повної інформації про акт
async function getActFullInfo(actId: number): Promise<any> {
  try {
    // Отримуємо дані акту
    const { data: act, error: actError } = await supabase
      .from('acts')
      .select('*')
      .eq('act_id', actId)
      .single();

    if (actError || !act) {
      throw new Error(`Не вдалося знайти акт з ID ${actId}`);
    }

    // Отримуємо дані клієнта
    let clientInfo = { fio: "Невідомий_клієнт", phone: "Без_телефону" };
    
    if (act.client_id) {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('client_id', act.client_id)
        .single();
      
      if (!clientError && client) {
        console.log('Дані клієнта з БД:', client);
        
        // Парсимо дані клієнта
        let clientData = null;
        if (client.data) {
          // Спробуємо різні варіанти структури даних
          if (client.data.data) {
            clientData = safeParseJSON(client.data.data);
          } else {
            clientData = safeParseJSON(client.data);
          }
        }
        
        console.log('Розпарсені дані клієнта:', clientData);
        
        // Отримуємо ім'я та телефон з різних можливих джерел
        const fio = clientData?.["ПІБ"] || 
                   clientData?.fio || 
                   client.data?.fio || 
                   client.fio || 
                   "Невідомий_клієнт";
                   
        const phone = clientData?.["Телефон"] || 
                     clientData?.phone || 
                     client.data?.phone || 
                     client.phone || 
                     "Без_телефону";
        
        clientInfo = {
          fio: fio.toString().trim() || "Невідомий_клієнт",
          phone: phone.toString().trim() || "Без_телефону"
        };
      }
    }

    // Отримуємо дані авто
    let carInfo = { auto: "Невідоме_авто", year: "0000" };
    
    if (act.cars_id) {
      const { data: car, error: carError } = await supabase
        .from('cars')
        .select('*')
        .eq('cars_id', act.cars_id)
        .single();
      
      if (!carError && car) {
        console.log('Дані авто з БД:', car);
        
        const carData = safeParseJSON(car.data);
        console.log('Розпарсені дані авто:', carData);
        
        const auto = carData?.["Авто"] || 
                    carData?.auto || 
                    car.auto || 
                    "Невідоме_авто";
                    
        const year = carData?.["Рік"] || 
                    carData?.year || 
                    car.year || 
                    "0000";
        
        carInfo = {
          auto: auto.toString().trim() || "Невідоме_авто",
          year: year.toString().trim() || "0000"
        };
      }
    }

    console.log('Фінальна інформація:', {
      act_id: actId,
      date_on: act.date_on,
      client: clientInfo,
      car: carInfo
    });

    return {
      act_id: actId,
      date_on: act.date_on,
      fio: clientInfo.fio,
      phone: clientInfo.phone,
      car: carInfo.auto,
      year: carInfo.year,
      act_data: act
    };
    
  } catch (error) {
    console.error('Помилка отримання інформації про акт:', error);
    throw error;
  }
}

// Функція для оновлення посилання на папку в базі даних
async function updateActPhotoLink(actId: number, driveUrl: string): Promise<void> {
  try {
    console.log(`Оновлюємо посилання для акту ${actId}: ${driveUrl}`);
    
    // Отримуємо поточний запис акту
    const { data: currentAct, error: fetchError } = await supabase
      .from('acts')
      .select('data')
      .eq('act_id', actId)
      .single();

    if (fetchError) {
      console.error('Помилка при отриманні акту:', fetchError);
      throw new Error(`Не вдалося знайти акт з ID ${actId}: ${fetchError.message}`);
    }

    if (!currentAct) {
      throw new Error(`Акт з ID ${actId} не знайдено`);
    }

    // Парсимо поточні дані
    let actData = currentAct.data || {};
    
    // Додаємо або оновлюємо посилання на папку з фото
    actData.Фото = [driveUrl];

    // Оновлюємо запис в базі даних
    const { error: updateError } = await supabase
      .from('acts')
      .update({ data: actData })
      .eq('act_id', actId);

    if (updateError) {
      console.error('Помилка при оновленні акту:', updateError);
      throw new Error(`Не вдалося оновити акт: ${updateError.message}`);
    }

    console.log(`Успішно оновлено посилання для акту ${actId}`);
    
    // Оновлення модального вікна після збереження
    await refreshPhotoData(actId);
    
  } catch (error) {
    console.error('Помилка при оновленні посилання на папку:', error);
    throw error;
  }
}

// ========== РОБОТА З МОДАЛЬНИМ ВІКНОМ ==========

// Функція для оновлення блоку фото в модальному вікні
export function updatePhotoSection(photoLinks: string[], isActClosed: boolean = false): void {
  const photoCell = document.querySelector('table.zakaz_narayd-table.left tr:nth-child(5) td:nth-child(2)');
  
  if (!photoCell) return;
  
 const photoHtml = photoLinks.length
  ? `<span style="color:green; text-decoration: underline;">Відкрити архів фото</span>`
  : `<span style="color:red; text-decoration: underline;">Створити фото Google</span>`;

  photoCell.innerHTML = photoHtml;
  
  // Повторно додаємо обробник для створення папки Google Drive, якщо посилань немає
  if (!photoLinks.length) {
    addGoogleDriveHandler(isActClosed);
  }
}

// Функція для додавання обробника Google Drive з перевіркою статусу
export function addGoogleDriveHandler(isActClosed: boolean = false): void {
  document
    .getElementById("open-google-drive-folder")
    ?.addEventListener("click", async (e) => {
      e.preventDefault();

      const modal = document.getElementById("zakaz_narayd-custom-modal");
      const actId = modal?.getAttribute("data-act-id");

      if (!actId) return;

      try {
        showNotification("Перевірка стану фото...", "info");

        // Отримуємо актуальні дані по акту
        const { data: act, error } = await supabase
          .from("acts")
          .select("data, date_off")
          .eq("act_id", Number(actId))
          .single();

        if (error || !act) {
          showNotification("Помилка отримання даних акту", "error");
          return;
        }

        const actData = safeParseJSON(act.data) || {};
        const existingLinks: string[] = Array.isArray(actData?.["Фото"])
          ? actData["Фото"]
          : [];

        // 🔗 Якщо вже є посилання на фото — відкриваємо, незалежно від статусу акту
        if (existingLinks.length > 0 && existingLinks[0]) {
          const existingUrl = existingLinks[0];
          showNotification("Відкриваємо Google папку...", "success");
          window.open(existingUrl, "_blank");
          return; // Важливо: завершуємо виконання, якщо посилання вже відкрито
        }

        // Якщо посилання немає, перевіряємо, чи акт закритий, перед створенням нової папки
        const isClosed = !!act.date_off;
        if (isClosed || isActClosed) {
          showNotification("Акт закритий — зміни заборонені (неможливо створити нову папку)", "warning");
          return;
        }

        // 📁 Інакше створюємо папку
        showNotification("Створення папки в Google Drive...", "info");

        const actInfo = await getActFullInfo(Number(actId));

        // Ця перевірка вже була вище, але залишаємо як додаткову гарантію
        if (actInfo.act_data.date_off) {
          showNotification("Акт закритий — неможливо створити папку", "warning");
          return;
        }

        await initGoogleApi();
        await createDriveFolderStructure(actInfo);

        showNotification("Папку успішно створено та відкрито", "success");

      } catch (err) {
        console.error("❌ Google Drive помилка:", err);
        showNotification("Не вдалося створити або відкрити папку", "error");
      }
    });
}


// Функція для оновлення даних фото з бази даних
export async function refreshPhotoData(actId: number): Promise<void> {
  try {
    const { data: act, error } = await supabase
      .from("acts")
      .select("data, date_off")
      .eq("act_id", actId)
      .single();

    if (error || !act) {
      console.error("Помилка при оновленні даних фото:", error);
      return;
    }

    const actData = safeParseJSON(act.data) || {};
    const photoLinks: string[] = Array.isArray(actData?.["Фото"])
      ? actData["Фото"]
      : [];

    const isActClosed = !!act.date_off;
    updatePhotoSection(photoLinks, isActClosed);
  } catch (error) {
    console.error("Помилка при оновленні фото:", error);
  }
}

// ========== ОСНОВНА ФУНКЦІЯ СТВОРЕННЯ СТРУКТУРИ ПАПОК ==========

export async function createDriveFolderStructure({ act_id, date_on, fio, phone, car, year }: {
  act_id: number;
  date_on: string;
  fio: string;
  phone: string;
  car: string;
  year: string;
}): Promise<void> {
  try {
    const date = new Date(date_on);
    const yyyy = `${date.getFullYear()}`;

    console.log(`Створюємо структуру папок для року: ${yyyy}`);
    console.log('Дані для створення папки:', { act_id, fio, phone, car, year });

    // Крок 1: Перевіряємо/створюємо папку року
    console.log(`Перевіряємо папку року: ${yyyy}`);
    const yearId = await findOrCreateFolder(yyyy);
    console.log(`ID папки року: ${yearId}`);

    // Крок 2: Створюємо папку акту з повною інформацією
    const folderNameParts = [
      `Акт_${act_id}`,
      fio && fio !== "—" && fio !== "Невідомий_клієнт" ? cleanNameComponent(fio) : null,
      car && car !== "—" && car !== "Невідоме_авто" ? cleanNameComponent(car) : null,
      year && year !== "—" && year !== "0000" ? cleanNameComponent(year) : null,
      phone && phone !== "—" && phone !== "Без_телефону" ? cleanNameComponent(phone) : null
    ].filter(Boolean); // Видаляємо порожні значення

    const cleanName = folderNameParts.join('_').substring(0, 100);
    
    console.log(`Створюємо папку акту: ${cleanName}`);
    const finalFolderId = await createFolder(cleanName, yearId);
    console.log(`ID папки акту: ${finalFolderId}`);

    // Формуємо посилання на папку
    const driveUrl = `https://drive.google.com/drive/folders/${finalFolderId}`;
    console.log(`Посилання на папку: ${driveUrl}`);

    // Оновлюємо базу даних з посиланням на папку
    await updateActPhotoLink(act_id, driveUrl);

    // Відкриваємо папку в новому вікні
    console.log(`Відкриваємо папку: ${driveUrl}`);
    window.open(driveUrl, '_blank');
    
    console.log('Структура папок успішно створена та посилання збережено в базі даних!');
  } catch (e) {
    console.error('Помилка створення структури папок:', e);
    alert(`Не вдалося створити структуру або зберегти посилання: ${e instanceof Error ? e.message : 'Невідома помилка'}. Деталі в консолі.`);
  }
}

// ========== УТИЛІТНІ ФУНКЦІЇ ДЛЯ АУТЕНТИФІКАЦІЇ ==========

export function checkAuthStatus(): boolean {
  return accessToken !== null;
}

export async function signOut(): Promise<void> {
  try {
    if (accessToken && google.accounts?.oauth2) {
      google.accounts.oauth2.revoke(accessToken);
    }
    accessToken = null;
    if (gapi.client) gapi.client.setToken(null);
  } catch (e) {
    console.error('Помилка при виході:', e);
  }
}

export async function testDriveConnection(): Promise<void> {
  try {
    await callDriveAPI('/files?pageSize=1&fields=files(id,name)');
  } catch (e) {
    throw handleError(e);
  }
}

export async function getCurrentUser(): Promise<any> {
  try {
    const res = await callDriveAPI('/about?fields=user');
    return res.user;
  } catch (e) {
    throw handleError(e);
  }
}