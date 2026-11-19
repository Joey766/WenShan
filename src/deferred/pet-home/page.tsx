import type { Metadata } from "next";
import { PetHome } from "./pet-home";
import { PetProvider } from "./growth-context";
import "./home.css";

export const metadata: Metadata = { title: "灵宠居所" };
export default function Page() {
  return <PetProvider><PetHome /></PetProvider>;
}
