import { describe, it, expect } from "vitest";
import type { FormQuestionDTO } from "@/lib/forms";
import { __testing } from "@/lib/visitLogs";

const { evaluateAnswerStatus } = __testing;

function buildQuestion(overrides: Partial<FormQuestionDTO>): FormQuestionDTO {
  const baseConfig: FormQuestionDTO["config"] = {
    weight: 1,
    expectedValue: undefined,
    min: undefined,
    max: undefined,
    minPhotos: undefined,
    maxPhotos: undefined,
    allowPartial: false,
    ...(overrides.config ?? {}),
  };

  return {
    id: "question-1",
    type: "short_text",
    title: "Pregunta",
    description: "",
    required: true,
    order: 0,
    options: [],
    config: baseConfig,
    ...overrides,
  };
}

describe("evaluateAnswerStatus", () => {
  it("marca como compliant cuando el valor esperado coincide en preguntas yes/no", () => {
    const question = buildQuestion({
      id: "q-yes-no",
      type: "yes_no",
      config: {
        weight: 1,
        expectedValue: true,
      },
    });

    const status = evaluateAnswerStatus(question, true, []);
    expect(status).toBe("compliant");
  });

  it("permite resultado parcial cuando se habilita allowPartial", () => {
    const question = buildQuestion({
      id: "q-partial",
      type: "yes_no",
      config: {
        weight: 1,
        expectedValue: true,
        allowPartial: true,
      },
    });

    const status = evaluateAnswerStatus(question, false, []);
    expect(status).toBe("partial");
  });

  it("marca como no conforme cuando un número está fuera del rango permitido", () => {
    const question = buildQuestion({
      id: "q-number",
      type: "number",
      config: {
        weight: 1,
        min: 10,
        max: 20,
      },
    });

    const status = evaluateAnswerStatus(question, 5, []);
    expect(status).toBe("non_compliant");
  });

  it("valida preguntas de selección múltiple asegurando opciones válidas", () => {
    const question = buildQuestion({
      id: "q-multi",
      type: "multi_select",
      options: [
        { id: "opt-1", value: "a", label: "A" },
        { id: "opt-2", value: "b", label: "B" },
      ],
      config: {
        weight: 1,
        allowPartial: true,
        expectedValue: ["a", "b"],
      },
    });

    const status = evaluateAnswerStatus(question, ["a"], []);
    expect(status).toBe("partial");
  });

  it("exige la cantidad mínima de fotografías configurada", () => {
    const question = buildQuestion({
      id: "q-photo",
      type: "photo",
      config: {
        weight: 1,
        minPhotos: 2,
      },
    });

    const status = evaluateAnswerStatus(question, null, ["foto1.jpg"]);
    expect(status).toBe("non_compliant");
  });

  it("acepta respuestas de texto válidas", () => {
    const question = buildQuestion({
      id: "q-text",
      type: "short_text",
    });

    const status = evaluateAnswerStatus(question, "Mercadería en orden", []);
    expect(status).toBe("compliant");
  });
});
