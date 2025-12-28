// autocompleteInput.ts - Модуль для автозаповнення редагованих полів

import { globalCache } from "../globalCache";

/**
 * Форматує число з пробілами для тисяч
 * @param num Число для форматування
 * @returns Відформатоване число
 */
export function formatNumberWithSpaces(num: number): string {
  return num.toLocaleString("ru-RU", { useGrouping: true }).replace(/,/g, " ");
}

/**
 * Парсить число з пробілами
 * @param str Рядок з числом
 * @returns Число
 */
export function parseNumberWithSpaces(str: string): number {
  return parseFloat(str.replace(/\s/g, "").replace(",", ".")) || 0;
}

/**
 * Оновлює стан `contenteditable` для всіх редагованих комірок.
 * Залежить від глобальної змінної `isActClosed` з `zakaz_narayd.ts`.
 * @param container Контейнер, в якому знаходяться редаговані комірки.
 */
export function updateContentEditableState(container: HTMLElement) {
  const editableCells = container.querySelectorAll(".editable-autocomplete");
  editableCells.forEach((cell: Element) => {
    const htmlCell = cell as HTMLElement;
    htmlCell.contentEditable = globalCache.isActClosed ? "false" : "true";
    if (globalCache.isActClosed) {
      htmlCell.blur();
    }
  });
}

/**
 * Визначає та встановлює `data-type` для комірки "ПІБ/Магазин"
 * на основі значення в комірці "Найменування" того ж рядка.
 * @param pibMagazinCell Комірка "ПІБ/Магазин".
 * @returns Визначений тип ('shops', 'slyusars', або порожній рядок, якщо невизначений).
 */
export function updatePibMagazinDataType(pibMagazinCell: HTMLElement): string {
  const currentRow = pibMagazinCell.closest("tr");
  const nameCell = currentRow?.querySelector(
    '[data-name="name"]'
  ) as HTMLElement;
  const nameQuery = nameCell?.textContent?.trim() || "";

  const isExactDetail = globalCache.details.some(
    (d) => d.toLowerCase() === nameQuery.toLowerCase()
  );
  const isExactWork = globalCache.works.some(
    (w) => w.toLowerCase() === nameQuery.toLowerCase()
  );

  let targetType = "";

  if (isExactDetail && !isExactWork) {
    targetType = "shops";
  } else if (isExactWork && !isExactDetail) {
    targetType = "slyusars";
  } else {
    targetType = ""; // Немає чіткого типу
  }
  pibMagazinCell.setAttribute("data-type", targetType);
  return targetType;
}

/**
 * Встановлює автозаповнення для редагованих комірок у вказаному контейнері.
 * @param containerId ID контейнера, в якому потрібно ініціалізувати автозаповнення.
 * @param cache Доступ до глобального кешу даних (globalCache з zakaz_narayd.ts).
 */
export function setupAutocompleteForEditableCells(
  containerId: string,
  cache: typeof globalCache
) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Обробник для фокусування
  container.addEventListener("focusin", (e) => {
    const target = e.target as HTMLElement;
    if (
      !target.classList.contains("editable-autocomplete") ||
      cache.isActClosed
    ) {
      return;
    }

    const query = target.textContent?.trim().toLowerCase() || "";
    let dataType = target.getAttribute("data-type");
    const dataName = target.getAttribute("data-name");

    let suggestions: string[] = [];

    if (dataName === "name") {
      suggestions = [...cache.details, ...cache.works];
    } else if (dataName === "pib_magazin") {
      dataType = updatePibMagazinDataType(target);
      if (dataType === "shops") {
        suggestions = cache.shops.map((s) => s.Name);
      } else if (dataType === "slyusars") {
        suggestions = cache.slyusars.map((s) => s.Name);
      }
    } else if (dataType === "shops") {
      suggestions = cache.shops.map((s) => s.Name);
    } else if (dataType === "slyusars") {
      suggestions = cache.slyusars.map((s) => s.Name);
    }

    if (
      query === "" &&
      suggestions.length > 0 &&
      document.querySelector(".autocomplete-list") === null
    ) {
      renderAutocompleteList(target, suggestions);
    } else if (
      query !== "" &&
      document.querySelector(".autocomplete-list") === null
    ) {
      document.querySelector(".autocomplete-list")?.remove();
      window.removeEventListener("scroll", handleScrollForAutocompleteList);
    }
  });

  // Обробник для введення
  container.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (
      !target.classList.contains("editable-autocomplete") ||
      cache.isActClosed
    ) {
      document.querySelector(".autocomplete-list")?.remove();
      return;
    }

    const query = target.textContent?.trim().toLowerCase() || "";
    let dataType = target.getAttribute("data-type");
    const dataName = target.getAttribute("data-name");

    let suggestions: string[] = [];

    if (dataName === "name") {
      const filteredDetails = cache.details.filter((text) =>
        text.toLowerCase().includes(query)
      );
      const filteredWorks = cache.works.filter((text) =>
        text.toLowerCase().includes(query)
      );
      suggestions = [...filteredDetails, ...filteredWorks];

      const currentRow = target.closest("tr");
      const pibMagazinCell = currentRow?.querySelector(
        '[data-name="pib_magazin"]'
      ) as HTMLElement;

      if (pibMagazinCell) {
        const currentPibMagazinText = pibMagazinCell.textContent?.trim() || "";
        const currentPibMagazinType = updatePibMagazinDataType(pibMagazinCell);

        if (
          currentPibMagazinType === "slyusars" &&
          !cache.slyusars
            .map((s) => s.Name.toLowerCase())
            .includes(currentPibMagazinText.toLowerCase()) &&
          currentPibMagazinText !== ""
        ) {
          pibMagazinCell.textContent = "";
        } else if (
          currentPibMagazinType === "shops" &&
          !cache.shops
            .map((s) => s.Name.toLowerCase())
            .includes(currentPibMagazinText.toLowerCase()) &&
          currentPibMagazinText !== ""
        ) {
          pibMagazinCell.textContent = "";
        } else if (query.length === 0) {
          pibMagazinCell.textContent = "";
        }
      }
    } else if (dataName === "pib_magazin") {
      dataType = updatePibMagazinDataType(target);

      if (dataType === "shops") {
        suggestions = cache.shops
          .map((s) => s.Name)
          .filter((name) => name.toLowerCase().includes(query));
      } else if (dataType === "slyusars") {
        suggestions = cache.slyusars
          .map((s) => s.Name)
          .filter((name) => name.toLowerCase().includes(query));
      }
    } else if (dataType === "shops") {
      suggestions = cache.shops
        .map((s) => s.Name)
        .filter((name) => name.toLowerCase().includes(query));
    } else if (dataType === "slyusars") {
      suggestions = cache.slyusars
        .map((s) => s.Name)
        .filter((name) => name.toLowerCase().includes(query));
    }

    if (suggestions.length > 0) {
      renderAutocompleteList(target, suggestions);
    } else {
      document.querySelector(".autocomplete-list")?.remove();
      window.removeEventListener("scroll", handleScrollForAutocompleteList);
    }
  });

  container.addEventListener("focusout", (e) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.closest(".autocomplete-list")) {
      return;
    }
    setTimeout(() => {
      if (
        !document.activeElement?.closest(".autocomplete-list") &&
        document.activeElement !== currentAutocompleteInput
      ) {
        document.querySelector(".autocomplete-list")?.remove();
        window.removeEventListener("scroll", handleScrollForAutocompleteList);
      }
    }, 100);
  });
}

let currentAutocompleteInput: HTMLElement | null = null;
let currentAutocompleteList: HTMLElement | null = null;

function handleScrollForAutocompleteList() {
  if (currentAutocompleteList && currentAutocompleteInput) {
    const rect = currentAutocompleteInput.getBoundingClientRect();
    const isVisible =
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth);

    if (!isVisible) {
      currentAutocompleteList.remove();
      currentAutocompleteList = null;
      currentAutocompleteInput = null;
      window.removeEventListener("scroll", handleScrollForAutocompleteList);
    } else {
      currentAutocompleteList.style.top = `${rect.bottom + window.scrollY}px`;
      currentAutocompleteList.style.left = `${rect.left + window.scrollX}px`;
    }
  } else {
    window.removeEventListener("scroll", handleScrollForAutocompleteList);
  }
}

function renderAutocompleteList(target: HTMLElement, suggestions: string[]) {
  document.querySelector(".autocomplete-list")?.remove();
  window.removeEventListener("scroll", handleScrollForAutocompleteList);

  if (suggestions.length === 0) return;

  const list = document.createElement("ul");
  list.className = "autocomplete-list";

  suggestions.forEach((suggestion) => {
    const li = document.createElement("li");
    li.textContent = suggestion;
    li.className = "autocomplete-item";
    li.tabIndex = 0;

    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      target.textContent = suggestion;
      list.remove();

      currentAutocompleteList = null;
      currentAutocompleteInput = null;
      window.removeEventListener("scroll", handleScrollForAutocompleteList);

      if (target.getAttribute("data-name") === "name") {
        const selectedName = suggestion;
        const currentRow = target.closest("tr");
        const pibMagazinCell = currentRow?.querySelector(
          '[data-name="pib_magazin"]'
        ) as HTMLElement;

        if (pibMagazinCell) {
          const isDetail = globalCache.details.some(
            (d: string) => d === selectedName
          );
          const isWork = globalCache.works.some(
            (w: string) => w === selectedName
          );

          let targetType = "";

          if (isDetail) {
            targetType = "shops";
            target.setAttribute("data-type", "details");
          } else if (isWork) {
            targetType = "slyusars";
            target.setAttribute("data-type", "works");
          } else {
            target.removeAttribute("data-type");
          }

          pibMagazinCell.setAttribute("data-type", targetType);
          pibMagazinCell.textContent = "";
        }
      }

      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.focus();
    });

    list.appendChild(li);
  });

  const rect = target.getBoundingClientRect();
  list.style.position = "absolute";
  list.style.top = `${rect.bottom + window.scrollY}px`;
  list.style.left = `${rect.left + window.scrollX}px`;
  list.style.minWidth = `${rect.width}px`;
  list.style.zIndex = "9999";
  document.body.appendChild(list);

  currentAutocompleteInput = target;
  currentAutocompleteList = list;
  window.addEventListener("scroll", handleScrollForAutocompleteList);
}

export function checkPibMagazinColumnVisibility() {
  const table = document.getElementById("orderTable") as HTMLTableElement;
  if (!table) return;

  let pibMagazinColIndex = -1;
  const headerCells = table.querySelector("thead tr")?.children;
  if (headerCells) {
    for (let i = 0; i < headerCells.length; i++) {
      if (headerCells[i].textContent?.trim() === "ПІБ/Магазин") {
        pibMagazinColIndex = i;
        break;
      }
    }
  }

  if (pibMagazinColIndex === -1) return;

  const shouldBeHidden = globalCache.isActClosed;

  Array.from(table.rows).forEach((row) => {
    if (row.children[pibMagazinColIndex]) {
      const cell = row.children[pibMagazinColIndex] as HTMLElement;
      if (shouldBeHidden) {
        cell.style.display = "none";
      } else {
        cell.style.display = "";
      }
    }
  });

  const headerRow = table.querySelector("thead tr");
  if (headerRow && headerRow.children[pibMagazinColIndex]) {
    const headerCell = headerRow.children[pibMagazinColIndex] as HTMLElement;
    if (shouldBeHidden) {
      headerCell.style.display = "none";
    } else {
      headerCell.style.display = "";
    }
  }
}
