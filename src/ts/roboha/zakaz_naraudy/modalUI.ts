// modalUI.ts - UI та відображення модального вікна

import {
  globalCache,
  ZAKAZ_NARAYD_MODAL_ID,
  ZAKAZ_NARAYD_BODY_ID,
  ZAKAZ_NARAYD_CLOSE_BTN_ID,
  ACT_ITEMS_TABLE_CONTAINER_ID,
  formatNumberWithSpaces,
} from "./globalCache";
import { setupAutocompleteForEditableCells } from "./inhi/kastomna_tabluca";

/**
 * Створює та ініціалізує основне модальне вікно
 */
export function createModal(): void {
  if (document.getElementById(ZAKAZ_NARAYD_MODAL_ID)) return;

  const modalOverlay = document.createElement("div");
  modalOverlay.id = ZAKAZ_NARAYD_MODAL_ID;
  modalOverlay.className = "zakaz_narayd-modal-overlay hidden";
  modalOverlay.innerHTML = `
    <div class="zakaz_narayd-modal-content">
      <button class="zakaz_narayd-modal-close" id="${ZAKAZ_NARAYD_CLOSE_BTN_ID}">&times;</button>
      <div class="zakaz_narayd-modal-body" id="${ZAKAZ_NARAYD_BODY_ID}"></div>
    </div>`;

  document.body.appendChild(modalOverlay);

  // Закриваємо ТІЛЬКИ по хрестику
  const closeBtn = modalOverlay.querySelector<HTMLButtonElement>(
    `#${ZAKAZ_NARAYD_CLOSE_BTN_ID}`
  );
  closeBtn?.addEventListener("click", () => {
    modalOverlay.classList.add("hidden");
    globalCache.currentActId = null;
    document.getElementById("add-row-button")?.remove();
  });
}

/**
 * Функція для розрахунку суми в рядку.
 * Оновлює значення в 'sum' комірці та викликає оновлення загальних сум у футері.
 */
export function calculateRowSum(row: HTMLTableRowElement) {
  const priceCell = row.querySelector(
    '[data-name="price"]'
  ) as HTMLTableCellElement;
  const quantityCell = row.querySelector(
    '[data-name="id_count"]'
  ) as HTMLTableCellElement;
  const sumCell = row.querySelector(
    '[data-name="sum"]'
  ) as HTMLTableCellElement;

  if (priceCell && quantityCell && sumCell) {
    // ✅ ВИПРАВЛЕННЯ: правильно отримуємо числові значення
    const priceText = priceCell.textContent?.trim() || "0";
    const quantityText = quantityCell.textContent?.trim() || "0";

    const price = parseFloat(priceText) || 0;
    const quantity = parseFloat(quantityText) || 0;
    const sum = price * quantity;

    // Відображаємо суму з пробілами для тисяч, але без копійок
    sumCell.textContent = formatNumberWithSpaces(Math.round(sum), 0, 0);
    updateCalculatedSumsInFooter();
  }
}

/**
 * Додає новий порожній рядок до таблиці.
 * @param containerId ID контейнера таблиці.
 */
export function addNewRow(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const tableBody = container.querySelector("tbody");
  if (!tableBody) return;

  const newRow = document.createElement("tr");
  const rowCount = tableBody.children.length + 1;
  const pibMagazinCellHTML = globalCache.settings.showPibMagazin
    ? `<td contenteditable="${!globalCache.isActClosed}" class="editable-autocomplete" data-name="pib_magazin" data-type=""></td>` // data-type буде визначено при введенні
    : "";

  newRow.innerHTML = `
    <td>${rowCount}</td>
    <td contenteditable="${!globalCache.isActClosed}" class="editable-autocomplete" data-name="name" data-type=""></td>
    <td contenteditable="${!globalCache.isActClosed}" class="text-right" data-name="id_count"></td>
    <td contenteditable="${!globalCache.isActClosed}" class="text-right" data-name="price"></td>
    <td class="text-right" data-name="sum">${formatNumberWithSpaces(0)}</td>
    ${pibMagazinCellHTML}
  `;

  tableBody.appendChild(newRow);

  // Ініціалізуємо автозаповнення для нового рядка
  if (!globalCache.isActClosed) {
    setupAutocompleteForEditableCells(containerId, globalCache);
  }
  updateCalculatedSumsInFooter(); // Оновлюємо суми у футері при додаванні нового рядка
}

/**
 * Генерує HTML для таблиці з урахуванням налаштувань
 *
 * @param allItems - Масив елементів для таблиці.
 * @param showPibMagazin - Чи відображати колонку ПІБ/Магазин.
 */
export function generateTableHTML(
  allItems: any[],
  showPibMagazin: boolean
): string {
  const pibMagazinColumnHeader = showPibMagazin ? "<th>ПІБ _ Магазин</th>" : "";

  let actItemsHtml = "";

  if (allItems.length > 0) {
    actItemsHtml = allItems
      .map((item: any, index: number) => {
        const price = parseFloat(item.price) || 0;
        const quantity = parseFloat(item.quantity) || 0;
        const sum = parseFloat(item.sum) || 0;

        const pibMagazinCellHTML = showPibMagazin
          ? `<td contenteditable="${!globalCache.isActClosed}" class="editable-autocomplete" data-name="pib_magazin" data-type="${
              item.type === "detail" ? "shops" : "slyusars"
            }">${item.person_or_store || ""}</td>`
          : "";

        const dataTypeForName = item.type === "detail" ? "details" : "works";

        return `
          <tr>
            <td>${index + 1}</td>
            <td contenteditable="${!globalCache.isActClosed}" class="editable-autocomplete" data-name="name" data-type="${dataTypeForName}">${
          item.name || ""
        }</td>
            <td contenteditable="${!globalCache.isActClosed}" class="text-right" data-name="id_count">${formatNumberWithSpaces(
          quantity
        )}</td>
            <td contenteditable="${!globalCache.isActClosed}" class="text-right" data-name="price">${formatNumberWithSpaces(
          Math.round(price)
        )}</td>
            <td class="text-right" data-name="sum">${formatNumberWithSpaces(
              Math.round(sum)
            )}</td>
            ${pibMagazinCellHTML}
          </tr>
        `;
      })
      .join("");
  } else {
    const pibMagazinCellHTML = showPibMagazin
      ? `<td contenteditable="${!globalCache.isActClosed}" class="editable-autocomplete" data-name="pib_magazin" data-type=""></td>`
      : "";
    actItemsHtml = `
      <tr>
        <td>1</td>
        <td contenteditable="${!globalCache.isActClosed}" class="editable-autocomplete" data-name="name" data-type=""></td>
        <td contenteditable="${!globalCache.isActClosed}" class="text-right" data-name="id_count"></td>
        <td contenteditable="${!globalCache.isActClosed}" class="text-right" data-name="price"></td>
        <td class="text-right" data-name="sum">${formatNumberWithSpaces(0)}</td>
        ${pibMagazinCellHTML}
      </tr>
      `;
  }

  const sumsFooter = `
    <div class="zakaz_narayd-sums-footer">
      <p><strong>За роботу:</strong> <span class="zakaz_narayd-sums-footer-sum" id="total-works-sum">${formatNumberWithSpaces(
        0
      )}</span> грн</p>
      <p><strong>За деталі:</strong> <span class="zakaz_narayd-sums-footer-sum" id="total-details-sum">${formatNumberWithSpaces(
        0
      )}</span> грн</p>
      <p><strong>Загальна сума:</strong> <span class="zakaz_narayd-sums-footer-total" id="total-overall-sum">${formatNumberWithSpaces(
        0
      )}</span> грн</p>
    </div>`;

  const buttons = !globalCache.isActClosed
    ? `
    <div class="zakaz_narayd-buttons-container">
      <button id="add-row-button" class="action-button add-row-button">➕ Додати рядок</button>
      <button id="save-act-data" class="zakaz_narayd-save-button" style="padding: 0.5rem 1rem;"> 💾 Зберегти зміни</button>
    </div>`
    : "";

  return `
    <div class="zakaz_narayd-table-container-value" id="${ACT_ITEMS_TABLE_CONTAINER_ID}">
      <table class="zakaz_narayd-items-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Найменування</th>
            <th class="text-right">К-ть</th>
            <th class="text-right">Ціна</th>
            <th class="text-right">Сума</th>
            ${pibMagazinColumnHeader}
          </tr>
        </thead>
        <tbody>
          ${actItemsHtml}
        </tbody>
      </table>
      ${sumsFooter}
      ${buttons}
    </div>`;
}

/**
 * Допоміжна функція для створення рядків таблиці
 */
export function createTableRow(
  label: string,
  value: string,
  className: string = ""
): string {
  // Для статичних рядків без editable
  return `<tr><td>${label}</td><td${
    className ? ` class="${className}"` : ""
  }>${value}</td></tr>`;
}

/**
 * Допоміжна функція для оновлення відображених сум у футері.
 * Ця функція перераховує суми на основі поточних даних у таблиці.
 */
export function updateCalculatedSumsInFooter() {
  const tableBody = document.querySelector(
    `#${ACT_ITEMS_TABLE_CONTAINER_ID} tbody`
  );
  if (!tableBody) return;

  let currentWorksSum = 0;
  let currentDetailsSum = 0;

  const detailsSet = new Set(globalCache.details);
  const worksSet = new Set(globalCache.works);

  tableBody.querySelectorAll("tr").forEach((row, rowIndex) => {
    const nameCell = row.querySelector('[data-name="name"]') as HTMLElement;
    const sumCell = row.querySelector('[data-name="sum"]') as HTMLElement;
    const iconCell = row.querySelector("td:first-child");

    if (!nameCell || !sumCell || !iconCell) return;

    const name = nameCell.textContent?.trim() || "";
    const sumText = sumCell.textContent?.replace(/\s/g, "") || "0";
    const sum = parseFloat(sumText) || 0;

    let type = nameCell.getAttribute("data-type");

    if (!type || (type !== "details" && type !== "works")) {
      const isInDetails = detailsSet.has(name);
      const isInWorks = worksSet.has(name);

      if (isInDetails && !isInWorks) {
        type = "details";
      } else if (isInWorks && !isInDetails) {
        type = "works";
      } else if (isInWorks && isInDetails) {
        type = "ambiguous";
      } else {
        type = "details"; // За замовчуванням
      }

      nameCell.setAttribute("data-type", type);
    }

    if (type === "details") {
      currentDetailsSum += sum;
      iconCell.textContent = `⚙️ ${rowIndex + 1}`;
    } else if (type === "works") {
      currentWorksSum += sum;
      iconCell.textContent = `🛠️ ${rowIndex + 1}`;
    } else {
      iconCell.textContent = `${rowIndex + 1}`;
    }
  });

  const totalWorksSumElement = document.getElementById("total-works-sum");
  const totalDetailsSumElement = document.getElementById("total-details-sum");
  const totalOverallSumElement = document.getElementById("total-overall-sum");

  if (totalWorksSumElement)
    totalWorksSumElement.textContent = formatNumberWithSpaces(
      Math.round(currentWorksSum),
      0,
      0
    );
  if (totalDetailsSumElement)
    totalDetailsSumElement.textContent = formatNumberWithSpaces(
      Math.round(currentDetailsSum),
      0,
      0
    );
  if (totalOverallSumElement)
    totalOverallSumElement.textContent = formatNumberWithSpaces(
      Math.round(currentWorksSum + currentDetailsSum),
      0,
      0
    );
}
