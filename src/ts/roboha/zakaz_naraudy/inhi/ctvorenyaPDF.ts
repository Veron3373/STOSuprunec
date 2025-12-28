// stvorenyaPDF.ts - Функціональність для створення PDF з модального вікна

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { showNotification } from "./vspluvauhe_povadomlenna";
import {
  globalCache,
  ZAKAZ_NARAYD_BODY_ID,
  ZAKAZ_NARAYD_SAVE_BTN_ID,
  ACT_ITEMS_TABLE_CONTAINER_ID,
} from "../globalCache";

/**
 * Генерує PDF-файл з вмісту модального вікна.
 */
export async function printModalToPdf(): Promise<void> {
  showNotification("Генерація PDF...", "info", 2000);

  const modalBody = document.getElementById(ZAKAZ_NARAYD_BODY_ID);
  if (!modalBody) {
    showNotification("Тіло модального вікна не знайдено.", "error");
    return;
  }

  // Зберігаємо оригінальні стилі та елементи для відновлення
  const originalBodyStyle = modalBody.style.cssText;
  const elementsToHide = [
    document.getElementById("print-act-button"),
    document.getElementById("add-row-button"),
    document.getElementById(ZAKAZ_NARAYD_SAVE_BTN_ID),
    document.getElementById("status-lock-btn"),
    document.getElementById("sklad"),
    document.querySelector(".modal-close-button") as HTMLElement,
    document.querySelector(".modal-footer") as HTMLElement,
  ];

  // Додаємо приховування стовпця "ПІБ / Магазин"
  const table = document.getElementById(ACT_ITEMS_TABLE_CONTAINER_ID) as HTMLTableElement | null;
  if (table) {
    const headerCells = table.querySelectorAll("thead th, thead td");
    let pibMagIndex = -1;

    headerCells.forEach((th, i) => {
      const text = th.textContent?.toLowerCase();
      if (text?.includes("піб") || text?.includes("магазин")) {
        pibMagIndex = i;
      }
    });

    if (pibMagIndex >= 0) {
      const selector = `th:nth-child(${pibMagIndex + 1}), td:nth-child(${pibMagIndex + 1})`;
      const columnCells = table.querySelectorAll<HTMLElement>(selector);
      columnCells.forEach((cell) => elementsToHide.push(cell));
    }
  }

  // Тимчасово приховуємо елементи
  elementsToHide.forEach((el) => el && (el.style.display = "none"));

  // Встановлюємо фіксовану ширину для контейнера
  const modalContent = document.querySelector('.zakaz_narayd-modal') as HTMLElement;
  const originalModalWidth = modalContent?.style.width || '';
  const originalModalMaxWidth = modalContent?.style.maxWidth || '';

  if (modalContent) {
    modalContent.style.width = '1000px';
    modalContent.style.maxWidth = '1000px';
  }

  // Змінюємо стиль, щоб розгорнути весь контент
  modalBody.style.overflow = "visible";
  modalBody.style.height = "auto";
  modalBody.style.maxHeight = "none";

  try {
    const canvas = await html2canvas(modalBody, {
      scale: 2, // Зберігаємо високий масштаб для якості
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.9); // Використовуємо JPEG для меншого розміру
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth - 20; // Відступи по 10 мм з кожного боку
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let y = 10; // Початковий відступ зверху

    // Додаємо першу сторінку
    pdf.addImage(imgData, "JPEG", 10, y, imgWidth, imgHeight);
    heightLeft -= (pageHeight - 10);

    // Якщо потрібно — додаємо ще сторінки
    while (heightLeft > 0) {
      y = y - pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 10, y, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const actNumber = globalCache.currentActId;
    pdf.save(`Акт №${actNumber}.pdf`);
    showNotification("PDF успішно створено!", "success", 2000);
  } catch (error) {
    console.error("💥 Помилка при генерації PDF:", error);
    showNotification("Помилка генерації PDF", "error");
  } finally {
    // Повертаємо оригінальні стилі та елементи
    elementsToHide.forEach((el) => el && (el.style.display = ""));
    modalBody.style.cssText = originalBodyStyle;

    if (modalContent) {
      modalContent.style.width = originalModalWidth;
      modalContent.style.maxWidth = originalModalMaxWidth;
    }
  }
}