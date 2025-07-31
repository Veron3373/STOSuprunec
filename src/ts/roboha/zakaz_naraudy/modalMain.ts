// modalMain.ts - Головна логіка модального вікна

import { supabase } from "../../vxid/supabaseClient";
import { showNotification } from "./inhi/vspluvauhe_povadomlenna";
import {
  addGoogleDriveHandler,
  safeParseJSON,
} from "./inhi/ctvorennia_papku_googleDrive.";
import { initPhoneClickHandler } from "./inhi/telefonna_pidskazka";
import { initOdometerInput } from "./inhi/odometr";
import { setupAutocompleteForEditableCells } from "./inhi/kastomna_tabluca";
import {
  createViknoPidtverdchennayZakruttiaAkty,
  showViknoPidtverdchennayZakruttiaAkty,
  viknoPidtverdchennayZakruttiaAktyId,
} from "./inhi/vikno_pidtverdchennay_zakruttia_akty";

// Додаємо імпорти для нового модального вікна вводу пароля
import {
  createViknoVvodyParolu,
  showViknoVvodyParolu,
  viknoVvodyParoluId,
} from "./inhi/vikno_vvody_parolu";

import {
  globalCache,
  loadGlobalData,
  ZAKAZ_NARAYD_MODAL_ID,
  ZAKAZ_NARAYD_BODY_ID,
  ZAKAZ_NARAYD_SAVE_BTN_ID,
  EDITABLE_PROBIG_ID,
  EDITABLE_REASON_ID,
  OPEN_GOOGLE_DRIVE_FOLDER_ID,
  ACT_ITEMS_TABLE_CONTAINER_ID,
  formatNumberWithSpaces,
  EDITABLE_RECOMMENDATIONS_ID, // Додано новий ID
} from "./globalCache";

import {
  createModal,
  calculateRowSum,
  addNewRow,
  generateTableHTML,
  createTableRow,
  updateCalculatedSumsInFooter,
} from "./modalUI";

// ІМПОРТ ФУНКЦІЇ ДЛЯ ОНОВЛЕННЯ ГОЛОВНОЇ ТАБЛИЦІ
import { refreshActsTable } from "../tablucya/tablucya"; // Переконайтеся, що шлях правильний

// НОВІ ІМПОРТИ ДЛЯ HTML2CANVAS ТА JSPDF
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf"; // <--- ДОДАЙТЕ ЦЕЙ РЯДОК

import { showModalAllOtherBases } from "../inichi_bazu_danux/inchi_bazu_danux";

// --- НОВІ/ОНОВЛЕНІ ФУНКЦІЇ ДЛЯ ОБРОБКИ ДАТИ/ЧАСУ ---

/**
 * Функція для форматування локальної дати та часу у формат 'YYYY-MM-DD HH:MM:SS'
 * для збереження в базі даних з колонкою 'timestamp without time zone'.
 * @param date Об'єкт Date, що представляє локальний час.
 * @returns Рядок дати та часу у форматі 'YYYY-MM-DD HH:MM:SS'.
 */
function formatLocalDateTimeForDB(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Місяці від 0 до 11
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Функція для форматування рядка дати з бази даних для відображення у локальному форматі.
 * Припускає, що рядок з БД є локальним часом, оскільки колонка 'timestamp without time zone'.
 * @param dateString Рядок дати з бази даних (наприклад, "2025-07-23 22:27:38").
 * @returns Відформатований рядок дати та часу або null.
 */
const formatDate = (dateString: string | null): string | null => {
  if (!dateString) {
    return null;
  }
  // Створюємо Date об'єкт з рядка.
  // НЕ ДОДАЄМО 'Z', оскільки рядок з БД вже є локальним часом.
  const date = new Date(dateString);

  return date.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// --- КІНЕЦЬ НОВИХ/ОНОВЛЕНИХ ФУНКЦІЙ ДЛЯ ОБРОБКИ ДАТИ/ЧАСУ ---

// --- НОВА ФУНКЦІЯ ДЛЯ ДРУКУ В PDF ---

/**
 * Генерує PDF-файл з вмісту модального вікна.
 */
async function printModalToPdf(): Promise<void> {
  showNotification("Генерація PDF...", "info", 2000);

  const modalBody = document.getElementById(ZAKAZ_NARAYD_BODY_ID);
  if (!modalBody) {
    showNotification("Тіло модального вікна не знайдено.", "error");
    return;
  }

  // Запам'ятовуємо поточний стан колонки ПІБ/Магазин
  const originalShowPibMagazin = globalCache.settings.showPibMagazin;
  
  // Приховуємо колонку ПІБ/Магазин
  globalCache.settings.showPibMagazin = false;
  updateTableColumnsVisibility();

  // Сховаємо зайві елементи
  const elementsToHide = [
    document.getElementById("print-act-button"),
    document.getElementById("add-row-button"),
    document.getElementById(ZAKAZ_NARAYD_SAVE_BTN_ID),
    document.getElementById("status-lock-btn"),
    document.getElementById("sklad"), // ⬅️ ДОДАЙ ЦЕ
    document.querySelector(".modal-close-button") as HTMLElement,
    document.querySelector(".modal-footer") as HTMLElement,
  ];
  elementsToHide.forEach((el) => el && (el.style.display = "none"));

  // Змінюємо стиль, щоб розгорнути весь контент
  const originalOverflow = modalBody.style.overflow;
  const originalHeight = modalBody.style.height;
  const originalMaxHeight = modalBody.style.maxHeight;
  modalBody.style.overflow = "visible";
  modalBody.style.height = "auto";
  modalBody.style.maxHeight = "none";

  try {
    const canvas = await html2canvas(modalBody, {
      scale: 2,
      useCORS: true,
      windowWidth: modalBody.scrollWidth,
      windowHeight: modalBody.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const x = (pageWidth - imgWidth) / 2;

    let y = 0;
    let heightLeft = imgHeight;

    // Додаємо першу сторінку
    pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Якщо потрібно — додаємо ще сторінки
    while (heightLeft > 0) {
      y = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const actNumber = globalCache.currentActId;
    pdf.save(`Акт №${actNumber}.pdf`);
    showNotification("PDF успішно створено!", "success", 2000);
  } catch (error) {
    console.error("💥 Помилка при генерації PDF:", error);
    showNotification("Помилка генерації PDF", "error");
  } finally {
    // Повертаємо стилі та елементи
    elementsToHide.forEach((el) => el && (el.style.display = ""));
    modalBody.style.overflow = originalOverflow;
    modalBody.style.height = originalHeight;
    modalBody.style.maxHeight = originalMaxHeight;
    
    // Відновлюємо колонку ПІБ/Магазин до початкового стану
    globalCache.settings.showPibMagazin = originalShowPibMagazin;
    updateTableColumnsVisibility();
  }
}

/**
 * Оновлює видимість колонки ПІБ/Магазин в таблиці
 */
function updateTableColumnsVisibility(): void {
  const table = document.querySelector(`#${ACT_ITEMS_TABLE_CONTAINER_ID} table`);
  if (!table) return;

  // 1. Тіло таблиці
  const pibMagazinCells = table.querySelectorAll('td[data-name="pib_magazin"]');
  pibMagazinCells.forEach((cell) => {
    if (globalCache.settings.showPibMagazin) {
      cell.removeAttribute('hidden');
    } else {
      cell.setAttribute('hidden', 'true');
    }
  });

  // 2. Заголовок: або через data-name, або через текст
  const headerCells = table.querySelectorAll('thead th');
  headerCells.forEach((th) => {
    const isTargetHeader =
      th.getAttribute("data-name") === "pib_magazin" ||
      th.textContent?.trim() === "ПІБ _ Магазин";

    if (isTargetHeader) {
      if (globalCache.settings.showPibMagazin) {
        th.removeAttribute("hidden");
      } else {
        th.setAttribute("hidden", "true");
      }
    }
  });
}

// --- КІНЕЦЬ НОВОЇ ФУНКЦІЇ ДЛЯ ДРУКУ В PDF ---

/**
 * Головна функція для відображення модального вікна з деталями акту
 */
export async function showModal(actId: number): Promise<void> {
  createModal();

  const modal = document.getElementById(ZAKAZ_NARAYD_MODAL_ID);
  const body = document.getElementById(ZAKAZ_NARAYD_BODY_ID);

  if (!modal || !body) {
    console.error("❌ Модальне вікно або його тіло не знайдені.");
    return;
  }

  await loadGlobalData();

  // Створюємо модальне вікно підтвердження закриття акту, якщо воно ще не існує
  if (!document.getElementById(viknoPidtverdchennayZakruttiaAktyId)) {
    const confirmationModal = createViknoPidtverdchennayZakruttiaAkty();
    document.body.appendChild(confirmationModal);
  }

  // Створюємо модальне вікно для вводу пароля, якщо воно ще не існує
  if (!document.getElementById(viknoVvodyParoluId)) {
    const passwordModal = createViknoVvodyParolu();
    document.body.appendChild(passwordModal);
  }

  globalCache.currentActId = actId;
  modal.setAttribute("data-act-id", actId.toString());

  showNotification("Завантаження даних акту...", "info", 2000);
  body.innerHTML = "";
  modal.classList.remove("hidden");

  try {
    const { data: act, error: actError } = await supabase
      .from("acts")
      .select("*")
      .eq("act_id", actId)
      .single();

    if (actError || !act) {
      showNotification(
        `Помилка завантаження акту: ${
          actError?.message || "Перевірте підключення."
        }`,
        "error"
      );
      body.innerHTML = `<p class="error-message">❌ Не вдалося завантажити акт. ${
        actError?.message || "Перевірте підключення."
      }</p>`;
      return;
    }

    globalCache.isActClosed = !!act.date_off;

    let clientInfo = { fio: "—", phone: "—", note: "—" };
    if (act.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("data")
        .eq("client_id", act.client_id)
        .single();

      const clientData = client?.data ? safeParseJSON(client.data) : null;
      if (clientData) {
        clientInfo = {
          fio: clientData["ПІБ"] || clientData.fio || "—",
          phone: clientData["Телефон"] || clientData.phone || "—",
          note: clientData["Додаткові"] || "—",
        };
      }
    }

    let carData: any = null;
    if (act.cars_id) {
      const { data: car } = await supabase
        .from("cars")
        .select("data")
        .eq("cars_id", act.cars_id)
        .single();
      if (car) {
        carData = safeParseJSON(car.data);
      }
    }

    const actDetails = safeParseJSON(act.info || act.data || act.details) || {};
    const auto = carData?.["Авто"] || "";
    const year = carData?.["Рік"] || "";
    const vin = carData?.["Vincode"] || "—";
    const kodDVZ = carData?.["КодДВЗ"] || "";
    const objem = carData?.["Обʼєм"] || "";
    const palne = carData?.["Пальне"] || "";
    const engine = [kodDVZ, objem, palne].filter(Boolean).join(" _ ") || "—";
    const probig = actDetails?.["Пробіг"] || "0";
    const reason = actDetails?.["Причина звернення"] || "—";
    const recommendations = actDetails?.["Рекомендації"] || "—"; // Отримуємо рекомендації

    const photoLinks: string[] = Array.isArray(actDetails?.["Фото"])
      ? actDetails["Фото"]
      : [];

    // Використання formatDate для обох полів
    const dateOffFormatted = formatDate(act.date_off);
    const dateOnFormatted = formatDate(act.date_on);

    const statusText = globalCache.isActClosed ? "Закритий" : "Відкритий";
    const statusHtml = `
      <div class="status-row">
        <div class="status-dates">
          ${
            globalCache.isActClosed
              ? `<span class="red">${dateOffFormatted}</span> | <span class="green">${dateOnFormatted}</span>`
              : `<span class="green">${dateOnFormatted || "-"}</span>`
          }
        </div>
        <button class="status-lock-icon" id="status-lock-btn" data-act-id="${actId}">${
      globalCache.isActClosed ? "🔒" : "🗝️"
    }</button>
      </div>
    `;

    const photoHtml = photoLinks.length
      ? photoLinks
          .map(
            (url) =>
              `<div><a href="${url}" target="_blank" style="color:green; text-decoration: none">Відкрити архів фото</a></div>`
          )
          .join("")
      : `<div><a href="#" id="${OPEN_GOOGLE_DRIVE_FOLDER_ID}" style="color:red; text-decoration: none">Створити фото Google</a></div>`;

    const details = actDetails?.["Деталі"] || [];
    const works = actDetails?.["Роботи"] || [];

    const allItems = [
      ...details.map((item: any) => ({
        type: "detail",
        name: item["Деталь"],
        quantity: item["Кількість"],
        price: item["Ціна"],
        sum: item["Сума"],
        person_or_store: item["Магазин"],
      })),
      ...works.map((item: any) => ({
        type: "work",
        name: item["Робота"],
        quantity: item["Кількість"],
        price: item["Ціна"],
        sum: item["Сума"],
        person_or_store: item["Слюсар"],
      })),
    ];

    const tableHTML = generateTableHTML(
      allItems,
      globalCache.settings.showPibMagazin
    );

    const editableClass = globalCache.isActClosed
      ? 'cursor: not-allowed;"'
      : "";
    const editableAttr = globalCache.isActClosed
      ? 'contenteditable="false"'
      : 'contenteditable="true"';

    // Додаємо новий блок тексту, якщо акт закритий
    const closedActClaimText = `
<div class="closed-act-info">
    <p><strong>Претензій до вартості замовлення, виконаних робіт, встановлених запчастин та використаних матеріалів не маю.</strong></p>
    <p><strong>Гарантійні зобов’язання</strong></p>
    <p>Виконавець гарантує відповідне відремонтованого ДТЗ (або його складових запчастин) вимогам технічної документації та нормативних документів виробника за умов виконання Замовником правил експлуатації ДТЗ. Гарантійний термін експлуатації на запасні частини встановлюється згідно з Законом України "Про захист прав споживачів". Гарантійні зобов'язання виконавця не розповсюджуються на запасні частини, надані Замовником. Деталі, що не були затребувані Замовником на момент видачі автомобіля, утилізуються та поверненню не підлягають. Цим підписом я надаю однозначну згоду на обробку моїх персональних даних з метою надання сервісних, гарантійних та інших супутніх послуг. Я повідомлений(на) про свої права, передбачені ст. 8 Закону України "Про захист персональних даних".</p>
    <br>
    <table>
        <tr>
            <td><strong>Замовник:</strong> З об'ємом та вартістю робіт згоден</td>
            <td><strong>Виконавець:</strong></td>
        </tr>
        <tr>
            <td><hr class="signature-line"></td>
            <td><hr class="signature-line"></td>
        </tr>
    </table>
</div>
    `;

    body.innerHTML = `
      <div class="zakaz_narayd-header">
        <div class="zakaz_narayd-header-info">
          <h1>B.S.Motorservice</h1>
          <p>Адрес: вул. Корольова, 6, Вінниця</p>
          <p>068 931 24 38 тел</p>
        </div>
      </div>

      <div class="zakaz_narayd-table-container">
        <table class="zakaz_narayd-table left">
          ${createTableRow(
            "Акт №",
            `<span id="act-number">${act.act_id.toString()}</span>`
          )}
          ${createTableRow("Клієнт", clientInfo.fio)}
          ${createTableRow(
            "Телефон",
            `<span style="color: blue;">${clientInfo.phone}</span>`
          )}
          ${createTableRow("Примітка:", clientInfo.note)}
          <tr>
            <td>Фото</td>
            <td id="${OPEN_GOOGLE_DRIVE_FOLDER_ID}" style="cursor: pointer;">
              ${photoHtml}
            </td>
          </tr>
        </table>

        <table class="zakaz_narayd-table right">
          ${createTableRow(statusText, statusHtml)}
          ${createTableRow("Марка / рік", `${auto} ${year}`.trim() || "—")}
          ${createTableRow("Vincode", vin)}
          ${createTableRow("Двигун", engine)}
          ${createTableRow(
            "Пробіг",
            `<span id="${EDITABLE_PROBIG_ID}" ${editableAttr} ${editableClass}>${formatNumberWithSpaces(
              probig,
              0,
              0
            )}</span>`
          )}
        </table>
      </div>

<div class="reason-container">

  <!-- Причина звернення -->
  <div class="zakaz_narayd-reason-line">
    <div class="reason-text">
      <strong>Причина звернення:</strong>
      <span id="${EDITABLE_REASON_ID}" class="highlight" ${editableAttr} ${editableClass}>${reason}</span>
    </div>
    <button id="print-act-button" title="Друк акту" class="print-button">🖨️</button>
  </div>

  <!-- Рекомендації -->
  <div class="zakaz_narayd-reason-line"> <!-- такий самий клас, як і вище -->
    <div class="recommendations-text">
      <strong>Рекомендації:</strong>
      <span id="${EDITABLE_RECOMMENDATIONS_ID}" class="highlight" ${editableAttr} ${editableClass}>${recommendations}</span>
    </div>
    <button id="sklad" title="Склад" class="sklad">📦</button>
  </div>

</div>



      ${tableHTML}
      ${globalCache.isActClosed ? closedActClaimText : ""} `;

    // Додаємо обробник для кнопки статусу замка
    addStatusLockHandler(actId);

    // НОВИЙ КОД: Додаємо обробник для кнопки друку
    const printButton = document.getElementById("print-act-button");
    // Додаємо обробник для кнопки "Склад"
    const skladButton = document.getElementById("sklad");
    if (skladButton) {
      skladButton.addEventListener("click", () => {
        showModalAllOtherBases(); // показуємо модальне вікно "інші бази"
      });
    }

    if (printButton) {
      printButton.addEventListener("click", printModalToPdf);
    }

    // Ініціалізація функціональності для відкритих актів
    if (!globalCache.isActClosed) {
      setupAutocompleteForEditableCells(
        ACT_ITEMS_TABLE_CONTAINER_ID,
        globalCache
      );

      const addRowButton = document.getElementById("add-row-button");
      if (addRowButton) {
        addRowButton.addEventListener("click", () =>
          addNewRow(ACT_ITEMS_TABLE_CONTAINER_ID)
        );
        addRowButton.addEventListener("mouseenter", () => {
          addRowButton.style.backgroundColor = "#45a049";
        });
        addRowButton.addEventListener("mouseleave", () => {
          addRowButton.style.backgroundColor = "#4CAF50";
        });
      }
    }

    // Додаємо обробники подій для редагування таблиці
    const tableContainer = document.getElementById(
      ACT_ITEMS_TABLE_CONTAINER_ID
    );
    if (tableContainer) {
      tableContainer.addEventListener("input", (e) => {
        const target = e.target as HTMLElement;
        const dataName = target.getAttribute("data-name");

        if (globalCache.isActClosed) {
          // Забороняємо редагування
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const caretPosition = range.startOffset;
            const textContent = target.textContent || "";
            target.textContent =
              textContent.slice(0, caretPosition - 1) +
              textContent.slice(caretPosition);
            // Відновлюємо позицію курсора
            range.setStart(
              target.firstChild || target,
              Math.max(0, caretPosition - 1)
            );
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          showNotification(
            "Неможливо редагувати закритий акт",
            "warning",
            1000
          );
          return;
        }

        if (dataName === "price" || dataName === "id_count") {
          let cleanedValue = target.textContent?.replace(/[^0-9]/g, "") || "";

          if (target.textContent !== cleanedValue) {
            const selection = window.getSelection();
            const originalCaretPosition = selection?.focusOffset || 0;
            target.textContent = cleanedValue;

            if (selection && target.firstChild) {
              const newCaretPosition = Math.min(
                originalCaretPosition,
                cleanedValue.length
              );
              const range = document.createRange();
              range.setStart(target.firstChild, newCaretPosition);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }

          const row = target.closest("tr") as HTMLTableRowElement;
          if (row) calculateRowSum(row);
        } else if (dataName === "name") {
          const name = target.textContent?.trim() || "";
          const row = target.closest("tr") as HTMLTableRowElement;
          const iconCell = row?.querySelector("td:first-child");

          let type = "";
          if (globalCache.details.includes(name)) {
            type = "details";
          } else if (globalCache.works.includes(name)) {
            type = "works";
          }

          target.setAttribute("data-type", type);

          if (iconCell) {
            const rowIndex = [...row.parentElement!.children].indexOf(row) + 1;
            iconCell.textContent =
              type === "details"
                ? `⚙️ ${rowIndex}`
                : type === "works"
                ? `🛠️ ${rowIndex}`
                : `${rowIndex}`;
          }

          updateCalculatedSumsInFooter();
        } else if (target.id === EDITABLE_PROBIG_ID) {
          let cleanedValue = target.textContent?.replace(/[^0-9]/g, "") || "";
          const formattedValue = formatNumberWithSpaces(cleanedValue, 0, 0);

          if (target.textContent !== formattedValue) {
            const selection = window.getSelection();
            const originalCaretPosition = selection?.focusOffset || 0;

            target.textContent = cleanedValue;
            if (selection && target.firstChild) {
              const newCaretPosition = Math.min(
                originalCaretPosition,
                cleanedValue.length
              );
              const range = document.createRange();
              range.setStart(target.firstChild, newCaretPosition);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            }

            target.textContent = formattedValue;

            if (selection && target.firstChild) {
              const formattedLength = formattedValue.length;
              const originalLength = cleanedValue.length;
              const diff = formattedLength - originalLength;
              const newCaretPosition = Math.min(
                originalCaretPosition + diff,
                formattedLength
              );
              const range = document.createRange();
              range.setStart(target.firstChild, Math.max(0, newCaretPosition));
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }
        }
      });
    }

    // Ініціалізація додаткової функціональності
    initPhoneClickHandler(body, clientInfo.phone);
    addGoogleDriveHandler(globalCache.isActClosed);
    addSaveHandler(actId, actDetails);
    initOdometerInput(EDITABLE_PROBIG_ID);

    updateCalculatedSumsInFooter();
    showNotification("Дані успішно завантажено", "success", 1500);
  } catch (error) {
    console.error("💥 Критична помилка при завантаженні акту:", error);
    showNotification(
      `Критична помилка завантаження акту: ${
        error instanceof Error ? error.message : "Невідома помилка"
      }`,
      "error"
    );
    body.innerHTML = `<p class="error-message">❌ Критична помислова завантаження акту. Перегляньте консоль.</p>`;
  }
}

/**
 * Додає обробник для кнопки статусу замка (відкриття/закриття акту)
 */
function addStatusLockHandler(actId: number): void {
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
        const passwordCorrect = await showViknoVvodyParolu(); // Показуємо вікно для пароля

        if (passwordCorrect) {
          try {
            showNotification("Відкриття акту...", "info");

            // Оновлюємо акт у базі даних, скидаючи дату закриття (date_off = null)
            const { error: updateError } = await supabase
              .from("acts")
              .update({
                date_off: null, // Встановлюємо дату закриття в null
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

            // ОНОВЛЕННЯ ГОЛОВНОЇ ТАБЛИЦІ
            refreshActsTable(); // <-- ВИКЛИК ТУТ
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
        return; // Виходимо, щоб не продовжувати логіку закриття
      }

      // Логіка для ЗАКРИТТЯ акту (якщо він НЕ закритий)
      const isConfirmed = await showViknoPidtverdchennayZakruttiaAkty(actId); // Передаємо actId

      if (!isConfirmed) {
        return; // Користувач скасував операцію
      }

      // Ця частина коду виконається, тільки якщо showViknoPidtverdchennayZakruttiaAkty повернув true
      try {
        showNotification("Закриття акту...", "info");

        // Оновлюємо акт у базі даних, встановлюючи поточну дату як дату закриття
        const { error: updateError } = await supabase
          .from("acts")
          .update({
            date_off: formatLocalDateTimeForDB(new Date()), // <--- ЗМІНА ТУТ
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

        // ОНОВЛЕННЯ ГОЛОВНОЇ ТАБЛИЦІ
        refreshActsTable(); // <-- ВИКЛИК ТУТ
      } catch (error) {
        console.error("Помилка при закритті акту:", error);
        showNotification("Критична помилка при закритті акту", "error");
      }
    });
  }
}

/**
 * Обробник збереження змін у даних акту
 */
function addSaveHandler(actId: number, originalActData: any): void {
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
          totalDetailsSum += sum; // Додаємо до суми деталей
        } else if (
          currentDataType === "works" ||
          globalCache.works.includes(name)
        ) {
          works.push({
            ...item,
            Робота: name,
            Слюсар: pibMagazin,
          });
          totalWorksSum += sum; // Додаємо до суми робіт
        } else {
          // За замовчуванням додаємо до деталей
          details.push({
            ...item,
            Деталь: name,
            Магазин: pibMagazin,
          });
          totalDetailsSum += sum; // Додаємо до суми деталей
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
        "За деталі": totalDetailsSum, // Зберігаємо суму за деталі
        "За роботу": totalWorksSum, // Зберігаємо суму за роботу
        "Загальна сума": grandTotalSum, // Зберігаємо загальну суму
      };

      try {
        showNotification("Збереження змін...", "info");

        // Оновлюємо поле 'data' акту в базі даних
        const { error: updateError } = await supabase
          .from("acts")
          .update({ data: updatedActData }) // Оновлюємо поле 'data'
          .eq("act_id", actId);

        if (updateError) {
          showNotification(
            "Помилка збереження: " + updateError.message,
            "error"
          );
          return;
        }

        showNotification("Зміни успішно збережено", "success");
        // Після успішного збереження, можливо, варто оновити відображення модального вікна
        // або просто оновити підсумкові суми у футері, якщо вони не оновлюються автоматично
        updateCalculatedSumsInFooter(); // Викликаємо для оновлення відображення
        refreshActsTable(); // Оновлюємо головну таблицю, щоб відобразити зміни
      } catch (error) {
        showNotification("Помилка збереження даних", "error");
        console.error("Помилка збереження:", error);
      }
    });
  }
}

/**
 * Додає слухачів подій "клік" на всі елементи з класом "act-row"
 * для відкриття модального вікна з відповідним актом.
 */
export function addModalOpenListeners(): void {
  document.querySelectorAll(".act-row").forEach((row) => {
    row.addEventListener("click", () => {
      const actId = Number(row.getAttribute("data-act-id"));
      if (!isNaN(actId)) {
        showModal(actId);
      }
    });
  });
}
