import { test } from "node:test";
import assert from "node:assert/strict";
import { colarFichas } from "./colarFichas.mjs";

test("separa por ponto e vírgula, TAB e barra", () => {
  const { fichas } = colarFichas("Capital da Bahia?; Salvador.\nPassado de to go?\tWent.\nQuantos lados tem um hexágono? | Seis.");
  assert.deepEqual(fichas, [
    { question: "Capital da Bahia?", answer: "Salvador." },
    { question: "Passado de to go?", answer: "Went." },
    { question: "Quantos lados tem um hexágono?", answer: "Seis." },
  ]);
});

test("ignora linhas sem as duas partes e pula linhas em branco", () => {
  const { fichas, ignoradas } = colarFichas("só pergunta\n\n; só resposta\nA?; B.\r\n   \n");
  assert.deepEqual(fichas, [{ question: "A?", answer: "B." }]);
  assert.equal(ignoradas, 2);
});

test("o resto da linha fica na resposta", () => {
  const { fichas } = colarFichas("Liste duas cores; azul; verde");
  assert.deepEqual(fichas, [{ question: "Liste duas cores", answer: "azul; verde" }]);
});

test("sem TAB, separa no primeiro ; ou | da linha", () => {
  const { fichas } = colarFichas("a | b; c\nTAB\tvem; antes");
  assert.deepEqual(fichas, [
    { question: "a", answer: "b; c" },
    { question: "TAB", answer: "vem; antes" },
  ]);
});
