import type { Metadata } from "next";
import { connection } from "next/server";
import InfoPage from "@/components/InfoPage";
import InstallButton from "@/components/InstallButton";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Descargar la app" };

export default async function DownloadsPage() {
  await connection(); // lee las variables en tiempo de ejecución, no al compilar
  const apk = process.env.APK_URL?.trim();
  const win = process.env.WINDOWS_URL?.trim();
  const card = (icon: string, title: string, text: string, body: React.ReactNode) => (
    <section className="card space-y-3"><h2 className="text-lg font-bold">{icon} {title}</h2><p className="text-sm text-muted">{text}</p>{body}</section>
  );
  return (
    <InfoPage title="Descarga la app" intro={`${BRAND.name} funciona en el navegador y también como app. Tus datos son los mismos en todos lados.`}>
      {card("🌐", "En el navegador", "Entra desde cualquier computador, tablet o celular. No necesitas instalar nada.", <a href="/login" className="btn">Abrir {BRAND.name}</a>)}
      {card("📲", "Instalar como app (rápido)", "Se agrega a la pantalla de inicio o al escritorio y abre sin la barra del navegador. Funciona en Android, Windows, Mac y iPhone.", <InstallButton />)}
      {card("🤖", "Android (APK)", "Instalador para celulares Android. Al abrir el archivo, Android puede pedirte permitir «instalar apps de orígenes desconocidos».",
        apk ? <a href={apk} className="btn">⬇ Descargar APK</a> : <p className="text-sm text-muted">Pronto disponible.</p>)}
      {card("🖥️", "Windows (instalador)", "Instalador para Windows 10 y 11. Si aparece el aviso de SmartScreen, elige «Más información» y «Ejecutar de todas formas».",
        win ? <a href={win} className="btn">⬇ Descargar para Windows</a> : <p className="text-sm text-muted">Pronto disponible.</p>)}
    </InfoPage>
  );
}
