// modalMain.ts - Головна логіка модального вікна (рефакторинг)

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
  viknoPidtverdchennayZakruttiaAktyId,
} from "./inhi/vikno_pidtverdchennay_zakruttia_akty";

// Додаємо імпорти для нового модального вікна вводу пароля
import {
  createViknoVvodyParolu,
  viknoVvodyParoluId,
} from "./inhi/vikno_vvody_parolu";

// ІМПОРТ ФУНКЦІЇ ДЛЯ PDF
import { printModalToPdf } from "./inhi/ctvorenyaPDF";

import {
  globalCache,
  loadGlobalData,
  ZAKAZ_NARAYD_MODAL_ID,
  ZAKAZ_NARAYD_BODY_ID,
  EDITABLE_PROBIG_ID,
  EDITABLE_REASON_ID,
  OPEN_GOOGLE_DRIVE_FOLDER_ID,
  ACT_ITEMS_TABLE_CONTAINER_ID,
  formatNumberWithSpaces,
  EDITABLE_RECOMMENDATIONS_ID,
} from "./globalCache";

import {
  createModal,
  calculateRowSum,
  addNewRow,
  generateTableHTML,
  createTableRow,
  updateCalculatedSumsInFooter,
} from "./modalUI";

import { showModalAllOtherBases } from "../inichi_bazu_danux/inchi_bazu_danux";

// Імпорти нових модулів
import { formatDate } from "./inhi/formatuvannya_datu";
import { addStatusLockHandler } from "./inhi/knopka_zamok";
import { addSaveHandler } from "./inhi/zberechennya_zmin_y_danux_aktu";

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
    const recommendations = actDetails?.["Рекомендації"] || "—";

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
    <p><strong>Гарантійні зобов'язання</strong></p>
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
          <h1>San Sanych</h1>
          <p>Адрес: м.Вінниця район крива</p>
          <p>067 732 51 15 тел</p>
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
  <div class="zakaz_narayd-reason-line">
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

    // Додаємо обробник для кнопки друку
    const printButton = document.getElementById("print-act-button");
    if (printButton) {
      printButton.addEventListener("click", printModalToPdf);
    }

    // Додаємо обробник для кнопки "Склад"
    const skladButton = document.getElementById("sklad");
    if (skladButton) {
      skladButton.addEventListener("click", () => {
        showModalAllOtherBases(); // показуємо модальне вікно "інші бази"
      });
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

// ✅ ОДИН раз підписуємось на подію оновлення інших баз
if (!(window as any).__otherBasesHandlerBound__) {
  document.addEventListener("other-base-data-updated", async () => {
    console.log("🔄 Оновлення глобальних даних після CRUD...");
    await loadGlobalData();

    const container = document.getElementById(ACT_ITEMS_TABLE_CONTAINER_ID);
    if (container) {
      setupAutocompleteForEditableCells(ACT_ITEMS_TABLE_CONTAINER_ID, globalCache);
      updateCalculatedSumsInFooter();
    }
  });
  (window as any).__otherBasesHandlerBound__ = true;
}

