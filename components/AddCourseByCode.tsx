"use client";
import ActionForm from "@/components/ActionForm";
import { linkCourseByCode } from "@/app/actions/center";

export default function AddCourseByCode() {
  return (
    <ActionForm action={linkCourseByCode} submit="Agregar curso">
      <label className="label" htmlFor="audit-code">Código de auditoría del curso</label>
      <input id="audit-code" name="code" className="input uppercase tracking-wider" placeholder="AUD-XXXXXXXXXXXX" required maxLength={20} autoComplete="off" />
    </ActionForm>
  );
}
