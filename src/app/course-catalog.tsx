"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type AvailableCourse = {
  id: string;
  title: string;
  description: string;
  _count: {
    concepts: number;
    enrollments: number;
  };
};

type CoursesResponse = {
  courses?: AvailableCourse[];
  error?: string;
};

export function CourseCatalog() {
  const router = useRouter();
  const [courses, setCourses] = useState<AvailableCourse[] | null>(null);
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCourses() {
      try {
        const response = await fetch("/api/courses");
        const result = (await response.json()) as CoursesResponse;
        if (!response.ok) {
          throw new Error(result.error ?? `Could not load courses (${response.status}).`);
        }
        if (active) setCourses(result.courses ?? []);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load courses. Please try again.",
          );
        }
      }
    }

    void loadCourses();
    return () => {
      active = false;
    };
  }, []);

  async function enroll(courseId: string) {
    setLoadingCourseId(courseId);
    setError(null);
    try {
      const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}/enroll`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? `Enrollment failed (${response.status}).`);
      }
      router.refresh();
    } catch (enrollError) {
      setError(
        enrollError instanceof Error
          ? enrollError.message
          : "Could not enroll in this course. Please try again.",
      );
    } finally {
      setLoadingCourseId(null);
    }
  }

  return (
    <section className="mt-7 text-left" aria-labelledby="course-catalog-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="course-catalog-heading" className="text-sm font-bold text-white">
          Available courses
        </h2>
        {courses && (
          <span className="text-[10px] text-white/40">
            {courses.length} {courses.length === 1 ? "course" : "courses"}
          </span>
        )}
      </div>

      {courses === null && !error && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-xs text-white/55">
          <LoaderCircle size={14} className="animate-spin" />
          Loading local courses…
        </div>
      )}

      {error && (
        <p
          className="rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-3 py-2 text-xs text-rose-100"
          role="alert"
        >
          {error}
        </p>
      )}

      {courses?.length === 0 && !error && (
        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-xs leading-5 text-white/55">
          There are no courses available yet. Ask an instructor to add one.
        </p>
      )}

      {courses && courses.length > 0 && (
        <ul className="grid gap-3">
          {courses.map((course) => {
            const enrolling = loadingCourseId === course.id;
            return (
              <li
                key={course.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200">
                    <BookOpen size={18} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">{course.title}</h3>
                    <p className="mt-1 text-[11px] leading-5 text-white/50">
                      {course.description}
                    </p>
                    <p className="mt-2 text-[10px] text-violet-200/75">
                      {course._count.concepts} concepts · {course._count.enrollments} learners
                    </p>
                  </div>
                </div>
                <button
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#9a85ff] px-4 py-2.5 text-xs font-bold text-[#211a50] transition hover:bg-[#b2a4ff] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loadingCourseId !== null}
                  onClick={() => void enroll(course.id)}
                  type="button"
                >
                  {enrolling ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin" />
                      Enrolling…
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Enroll
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
