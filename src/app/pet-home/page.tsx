import type { Metadata } from "next";
import { PetHome } from "@/components/pet-home";
import "./pet-home.css";

export const metadata: Metadata = { title: "我的灵宠" };

export default function Page() {
  return <PetHome />;
}
