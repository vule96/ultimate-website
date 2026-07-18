"use client";
import { useEffect } from "react";
import { useMagazineStore } from "../store/magazine-store";

// Hydrate phiên reader (login state + bookmark) MỘT LẦN cho toàn site —
// mount ở layout gốc thay vì trong MagazineBoard (chỉ render ở "/") để
// refresh trực tiếp /blog/[slug] hay /tags/* cũng thấy đúng trạng thái
// đăng nhập/số lượng đã lưu ở Masthead.
export function ReaderHydrator() {
  useEffect(() => {
    void useMagazineStore.getState().hydrate();
  }, []);
  return null;
}
