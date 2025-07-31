import { supabase } from "../../vxid/supabaseClient";
import {
  showSavePromptModal,
  createSavePromptModal,
  savePromptModalId,
} from "./vekno_pidtverdchennay_inchi_bazu";

// Змінна для експорту
export let all_bd: string | null = null;

// Змінна для експорту CRUD режиму
export let CRUD: string = "";

// Змінна, щоб тримати останні завантажені дані
let currentLoadedData: any[] = [];
let currentConfig: {
  table: string;
  field: string;
  deepPath?: string[];
  needsJsonParsing?: boolean;
} | null = null;

document.addEventListener("DOMContentLoaded", () => {
  const existing = document.getElementById(savePromptModalId);
  if (!existing) {
    const modal = createSavePromptModal();
    document.body.appendChild(modal);
  }
});

const databaseMapping: Record<
  string,
  {
    table: string;
    field: string;
    deepPath?: string[];
    needsJsonParsing?: boolean;
  }
> = {
  Робота: { table: "works", field: "data" },
  Деталі: { table: "details", field: "data" },
  Джерело: {
    table: "incomes",
    field: "data",
    deepPath: ["Name"],
    needsJsonParsing: true,
  },
  Приймальник: {
    table: "receivers",
    field: "data",
    deepPath: ["Name"],
    needsJsonParsing: true,
  },
  Магазини: {
    table: "shops",
    field: "data",
    deepPath: ["Name"],
    needsJsonParsing: true,
  },
  Слюсар: {
    table: "slyusars",
    field: "data",
    deepPath: ["Name"],
    needsJsonParsing: true,
  },
};

const extractNestedValue = (obj: any, path: string[]): string | undefined => {
  return path.reduce(
    (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
    obj
  );
};

// Функція для оновлення all_bd при виборі даних з інпута
const updateAllBdFromInput = (
  inputValue: string,
  isFromDropdown: boolean = false
) => {
  // Якщо інпут порожній - НЕ очищаємо all_bd, залишаємо попереднє значення
  if (!inputValue.trim()) {
    return; // Просто виходимо з функції, не змінюючи all_bd
  }

  if (!currentConfig) {
    // Тільки якщо немає конфігурації - можемо очистити
    all_bd = null;
    return;
  }

  const { table, field, deepPath, needsJsonParsing } = currentConfig;

  // Спочатку шукаємо збіг у завантажених даних
  let foundMatch = false;
  if (currentLoadedData && currentLoadedData.length > 0) {
    for (const item of currentLoadedData) {
      let parsed = item;
      if (needsJsonParsing && typeof item[field] === "string") {
        try {
          parsed = { ...item, [field]: JSON.parse(item[field]) };
        } catch {
          continue;
        }
      }

      let valueToCheck: string | undefined;
      if (deepPath) {
        valueToCheck = extractNestedValue(parsed[field], deepPath);
      } else {
        valueToCheck =
          needsJsonParsing || typeof item[field] === "object"
            ? parsed[field]
            : item[field];
        if (typeof valueToCheck === "object")
          valueToCheck = JSON.stringify(valueToCheck);
        else if (typeof valueToCheck !== "string")
          valueToCheck = String(valueToCheck);
      }

      if (valueToCheck?.trim() === inputValue.trim()) {
        foundMatch = true;
        const singularTable = table.endsWith("s") ? table.slice(0, -1) : table;
        const idField = `${singularTable}_id`;
        const idValue = item[idField] !== undefined ? item[idField] : null;

        let dataFieldValue: any;
        if (needsJsonParsing && typeof item[field] === "string") {
          try {
            dataFieldValue = JSON.parse(item[field]);
          } catch {
            dataFieldValue = item[field];
          }
        } else {
          dataFieldValue = item[field];
        }

        const result = {
          table: table,
          [idField]: idValue,
          data:
            deepPath && deepPath.length === 1
              ? { [deepPath[0]]: extractNestedValue(dataFieldValue, deepPath) }
              : typeof dataFieldValue === "object" &&
                !Array.isArray(dataFieldValue)
              ? dataFieldValue
              : { [field]: dataFieldValue },
        };

        all_bd = JSON.stringify(result, null, 2);
        return;
      }
    }
  }

  // Якщо збіг не знайдено:
  // - При виборі з dropdown (не повинно статися, але на всякий випадок) - перезаписуємо
  // - При ручному введенні - НЕ перезаписуємо, залишаємо попереднє значення
  if (!foundMatch) {
    if (isFromDropdown) {
      // Це не повинно статися при виборі з dropdown, але якщо сталося - створюємо новий запис
      const singularTable = table.endsWith("s") ? table.slice(0, -1) : table;
      const idField = `${singularTable}_id`;

      const newRecordResult = {
        table: table,
        [idField]: null, // null означає новий запис
        data:
          deepPath && deepPath.length === 1
            ? { [deepPath[0]]: inputValue.trim() }
            : { [field]: inputValue.trim() },
      };

      all_bd = JSON.stringify(newRecordResult, null, 2);
    }
    // При ручному введенні (isFromDropdown = false) нічого не робимо - залишаємо попереднє значення all_bd
  }
};

// Функція для оновлення CRUD змінної (тільки режим, НЕ all_bd)
const updateCRUD = (newMode: string) => {
  CRUD = newMode;
  // Тільки записуємо режим, НЕ торкаємось all_bd
};

// Функція для оновлення відображення назви таблиці в інтерфейсі
const updateTableNameDisplay = (buttonText: string, tableName: string) => {
  const tableNameElement = document.getElementById("current-table-name");
  if (tableNameElement) {
    tableNameElement.textContent = `Поточна таблиця: ${buttonText} (${tableName})`;
  }
};

const createCustomDropdown = (
  data: any[],
  field: string,
  inputElement: HTMLInputElement | null,
  deepPath?: string[],
  needsJsonParsing?: boolean
) => {
  const dropdown = document.getElementById(
    "custom-dropdown-all_other_bases"
  ) as HTMLDivElement;
  if (!dropdown || !inputElement) return;

  currentLoadedData = data;

  const values = data
    .map((item) => {
      let parsed = item;
      if (needsJsonParsing && typeof item[field] === "string") {
        try {
          parsed = { ...item, [field]: JSON.parse(item[field]) };
        } catch {
          return null;
        }
      }

      let value;
      if (deepPath) {
        value = extractNestedValue(
          needsJsonParsing ? parsed[field] : item[field],
          deepPath
        );
      } else {
        value =
          needsJsonParsing || typeof item[field] === "object"
            ? parsed[field]
            : item[field];
      }

      if (value !== null && value !== undefined) {
        return String(value).trim();
      }

      return null;
    })
    .filter((val): val is string => typeof val === "string" && val.length > 0);

  const uniqueValues = [...new Set(values)].sort();

  const renderSuggestions = (filter: string) => {
    dropdown.innerHTML = "";

    const filtered = uniqueValues.filter((val) =>
      val.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      dropdown.classList.add("hidden-all_other_bases");
      return;
    }

    filtered.forEach((val) => {
      const item = document.createElement("div");
      item.className = "custom-dropdown-item";
      item.textContent = val;
      item.addEventListener("click", () => {
        inputElement.value = val;
        dropdown.classList.add("hidden-all_other_bases");

        // Завжди оновлюємо all_bd при виборі з dropdown
        updateAllBdFromInput(val, true);
      });
      dropdown.appendChild(item);
    });

    dropdown.classList.remove("hidden-all_other_bases");
  };

  inputElement.addEventListener("input", () => {
    renderSuggestions(inputElement.value.trim());

    // При ручному введенні НЕ перезаписуємо all_bd якщо немає збігу
    updateAllBdFromInput(inputElement.value.trim(), false);
  });

  inputElement.addEventListener("focus", () => {
    renderSuggestions(inputElement.value.trim());
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target as Node) && e.target !== inputElement) {
      dropdown.classList.add("hidden-all_other_bases");
    }
  });

  const rect = inputElement.getBoundingClientRect();
  dropdown.style.minWidth = `${rect.width}px`;
};

const loadDatabaseData = async (buttonText: string) => {
  const config = databaseMapping[buttonText];
  if (!config) return;

  currentConfig = config;

  try {
    const searchInput = document.getElementById(
      "search-input-all_other_bases"
    ) as HTMLInputElement;
    if (searchInput) searchInput.value = "";

    // Записуємо базову інформацію про вибрану базу даних в all_bd
    all_bd = JSON.stringify(
      {
        config: config,
        table: config.table,
        input: "",
      },
      null,
      2
    );

    updateTableNameDisplay(buttonText, config.table);

    const { data, error } = await supabase.from(config.table).select("*");
    if (error || !data) throw new Error(error?.message || "Дані не отримані");

    createCustomDropdown(
      data,
      config.field,
      searchInput,
      config.deepPath,
      config.needsJsonParsing
    );
  } catch (err) {
    console.error(`Помилка завантаження з ${buttonText}`, err);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(".toggle-button-all_other_bases")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        document
          .querySelectorAll(".toggle-button-all_other_bases")
          .forEach((btn) => btn.classList.remove("active-all_other_bases"));
        button.classList.add("active-all_other_bases");

        const btnText = button.textContent?.trim() || "";
        if (btnText) await loadDatabaseData(btnText);
      });
    });
});

document.addEventListener("DOMContentLoaded", () => {
  const closeAllModals = () => {
    document
      .querySelectorAll(".modal-overlay-all_other_bases")
      .forEach((modal) => modal.classList.add("hidden-all_other_bases"));
  };

  const modal_all_other_bases = document.createElement("div");
  modal_all_other_bases.className =
    "modal-overlay-all_other_bases hidden-all_other_bases";
  modal_all_other_bases.innerHTML = `
    <div class="modal-all_other_bases">
      <button class="modal-close-all_other_bases">×</button>
      <div class="modal-content-all_other_bases">
        <div class="modal-left-all_other_bases">
          <button class="toggle-button-all_other_bases">Деталі</button>
          <button class="toggle-button-all_other_bases">Робота</button>
          <button class="toggle-button-all_other_bases">Магазини</button>
          <button class="toggle-button-all_other_bases">Слюсар</button>
          <button class="toggle-button-all_other_bases">Приймальник</button>
          <button class="toggle-button-all_other_bases">Джерело</button>
        </div>
        <div class="modal-right-all_other_bases">
           <label for="search-input-all_other_bases" class="label-all_other_bases">Введіть дані для пошуку</label>
           <div id="modeToggleLabel" style="cursor: pointer; font-weight: bold; color: orange;">Редагувати</div>
           <div style="position: relative; width: 100%;">
            <input type="text" id="search-input-all_other_bases" class="input-all_other_bases" />
             <div id="custom-dropdown-all_other_bases" class="custom-dropdown hidden-all_other_bases"></div>
             <span id="modeIconSwitcher" class="confirm-button-all_other_bases edit" style="position: absolute; right: 10px; top: 10px; font-size: 24px; cursor: pointer; color: orange;">🔁</span>
        </div>
  <div class="yes-no-buttons-all_other_bases">
    <button class="yes-button-all_other_bases">Ок</button>

  </div>
</div>

      </div>
    </div>
  `;
  document.body.appendChild(modal_all_other_bases);

  const yesButton = modal_all_other_bases.querySelector(
    ".yes-button-all_other_bases"
  ) as HTMLButtonElement;

  if (yesButton) {
    yesButton.addEventListener("click", async () => {
      try {
        const confirmed = await showSavePromptModal();
        if (confirmed) {
          modal_all_other_bases.classList.add("hidden-all_other_bases");

          // Перейти на "Джерело"
          const zhereloBtn = Array.from(
            document.querySelectorAll(".toggle-button-all_other_bases")
          ).find(
            (btn) => btn.textContent?.trim() === "Джерело"
          ) as HTMLButtonElement;

          if (zhereloBtn) {
            zhereloBtn.click();
          }
        }
      } catch (error) {
        console.error(
          "Помилка при показі модального вікна підтвердження:",
          error
        );
      }
    });
  }

  // Додаємо обробник для кнопки показу all_bd
  const debugButton = modal_all_other_bases.querySelector(
    ".debug-button-all_other_bases"
  ) as HTMLButtonElement;

  if (debugButton) {
    debugButton.addEventListener("click", () => {
      if (all_bd && typeof all_bd === "string" && all_bd.startsWith("{")) {
        try {
          const parsedData = JSON.parse(all_bd);
          console.log("Розпарсені дані:", parsedData);
        } catch (e) {
          console.log("Помилка парсингу JSON:", e);
        }
      } else {
        console.log("all_bd містить:", all_bd);
      }
      console.log("CRUD режим:", CRUD);
      console.log("==================");
    });
  }

  const noButton = modal_all_other_bases.querySelector(
    ".no-button-all_other_bases"
  ) as HTMLButtonElement;

  if (noButton) {
    noButton.addEventListener("click", () => {
      modal_all_other_bases.classList.add("hidden-all_other_bases");
    });
  }

  const closeModalBtn = modal_all_other_bases.querySelector(
    ".modal-close-all_other_bases"
  ) as HTMLButtonElement;
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      modal_all_other_bases.classList.add("hidden-all_other_bases");
    });
  }

  const toggleButtons = modal_all_other_bases.querySelectorAll(
    ".toggle-button-all_other_bases"
  );
  toggleButtons.forEach((button) => {
    button.classList.add("inactive-all_other_bases");
    button.addEventListener("click", async () => {
      toggleButtons.forEach((btn) =>
        btn.classList.remove("active-all_other_bases")
      );
      button.classList.add("active-all_other_bases");

      const buttonText = button.textContent?.trim() || "";
      if (buttonText) {
        await loadDatabaseData(buttonText);
      }
    });
  });

  document
    .querySelectorAll('a.menu-link.all_other_bases[data-action="openClient"]')
    .forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        closeAllModals();
        modal_all_other_bases.classList.remove("hidden-all_other_bases");
      });
    });

  const modeLabel = document.getElementById("modeToggleLabel") as HTMLElement;
  const modes = ["Редагувати", "Додати", "Видалити"];
  const colors = ["orange", "green", "crimson"];
  const modeIcons = ["🔁", "➕", "❌"];
  let modeIndex = 0;

  // Ініціалізуємо початковий режим
  if (modeLabel) {
    modeLabel.textContent = modes[modeIndex];
    modeLabel.style.color = colors[modeIndex];
    updateCRUD(modes[modeIndex]);
  }

  const handleModeSwitch = () => {
    modeIndex = (modeIndex + 1) % modes.length;
    if (modeLabel) {
      modeLabel.textContent = modes[modeIndex];
      modeLabel.style.color = colors[modeIndex];
      // Оновлюємо тільки CRUD змінну при зміні режиму
      updateCRUD(modes[modeIndex]);
    }

    const iconEl = document.getElementById("modeIconSwitcher") as HTMLElement;
    if (iconEl) {
      iconEl.textContent = modeIcons[modeIndex];
      iconEl.style.color = colors[modeIndex];
    }
  };

  if (modeLabel) {
    modeLabel.addEventListener("click", handleModeSwitch);
  }

  const iconSwitcher = document.getElementById("modeIconSwitcher");
  if (iconSwitcher) {
    iconSwitcher.addEventListener("click", handleModeSwitch);
  }
});
// Додайте цей код в файл інші_бази_даних.ts

// Функція для очищення всіх даних
const clearAllData = () => {
  // Очищаємо інпут
  const searchInput = document.getElementById(
    "search-input-all_other_bases"
  ) as HTMLInputElement;
  if (searchInput) {
    searchInput.value = "";
  }

  // Очищаємо dropdown
  const dropdown = document.getElementById(
    "custom-dropdown-all_other_bases"
  ) as HTMLDivElement;
  if (dropdown) {
    dropdown.innerHTML = "";
    dropdown.classList.add("hidden-all_other_bases");
  }

  // Очищаємо змінні
  all_bd = null;
  currentLoadedData = [];
  currentConfig = null;
};

// Оновіть обробник кнопок таким чином:
document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(".toggle-button-all_other_bases")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        // Спочатку очищаємо всі дані
        clearAllData();

        // Оновлюємо активну кнопку
        document
          .querySelectorAll(".toggle-button-all_other_bases")
          .forEach((btn) => btn.classList.remove("active-all_other_bases"));
        button.classList.add("active-all_other_bases");

        const btnText = button.textContent?.trim() || "";
        if (btnText) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            alert("⛔ Доступ заблоковано , Ви не авторизовані");
            return;
          }

          await loadDatabaseData(btnText);
        }
      });
    });
});


export function showModalAllOtherBases() {
  const modal = document.querySelector(
    ".modal-overlay-all_other_bases"
  ) as HTMLElement;
  if (modal) {
    modal.classList.remove("hidden-all_other_bases");
  }
}
