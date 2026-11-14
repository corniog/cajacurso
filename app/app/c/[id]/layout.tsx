import Link from "next/link";
import CourseNav from "@/components/CourseNav";
import { requireCourse } from "@/lib/auth";
import { isPro } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function CourseLayout({ children, params }: LayoutProps<"/app/c/[id]">) {
  const { id } = await params;
  const { course, role } = await requireCourse(id);
  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link href="/app" className="text-sm text-muted hover:text-brand">← Mis cursos</Link>
        <h1 className="text-xl font-bold">{course.name} · {course.year}</h1>
        <span className="text-sm text-muted">{course.school}</span>
        {isPro(course) ? <span className="badge bg-amber-100 text-amber-900">Plan Pro</span> : <span className="badge bg-slate-100 text-slate-600">Plan Gratis</span>}
        {role === "viewer" && <span className="badge bg-blue-100 text-blue-800">Solo lectura</span>}
      </div>
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <aside className="no-print"><CourseNav courseId={id} /></aside>
        <section className="min-w-0 space-y-5">{children}</section>
      </div>
    </div>
  );
}
