import Link from "next/link";
export default function NotFound() { return <section className="shell section empty-state"><h1>Página não encontrada</h1><p>O conteúdo pode ter sido removido ou o endereço está incorreto.</p><Link className="button" href="/">Voltar ao início</Link></section>; }
