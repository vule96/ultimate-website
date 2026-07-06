// ts-reset — vá các type built-in "lỏng" của TS thành chặt chẽ hơn
// (JSON.parse → unknown, .filter(Boolean) narrow đúng, array.includes linh hoạt, ...).
import "@total-typescript/ts-reset";
