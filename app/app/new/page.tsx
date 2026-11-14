import ActionForm from "@/components/ActionForm";
import CourseFields from "@/components/CourseFields";
import { createCourse } from "@/app/actions/course";

export const metadata = { title: "Crear curso" };

export default function NewCoursePage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Crear nuevo curso</h1>
        <p className="text-sm text-muted">Al guardar, se genera el código y el enlace para compartir con los apoderados.</p>
      </div>
      <div className="card">
        <ActionForm action={createCourse} submit="Crear curso" resetOnSuccess={false}>
          <CourseFields />
        </ActionForm>
      </div>
    </div>
  );
}
