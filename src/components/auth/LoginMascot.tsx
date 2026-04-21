"use client";

import gsap from "gsap";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type RefObject
} from "react";

/** Farmer login mascot: eyes follow the email caret; hands cover eyes on password focus. */

const MINT_BG = "#d4ede4";
const SKIN = "#f2d2b0";
const SKIN_HI = "#fcdcc4";
const STROKE = "#1a3d2e";
const ACCENT = "#3d9f6c";
const OVERALLS = "#4a6e8c";
const OVERALLS_HI = "#6f92b3";
const BIB = "#e8eef6";
const HAT_STRAW = "#edd6a4";
const HAT_BAND = "#4a3728";
const SHIRT = "#c9dae8";
const MOUTH_FILL = "#8f5a52";

function getAngle(x1: number, y1: number, x2: number, y2: number) {
  return Math.atan2(y1 - y2, x1 - x2);
}

function getPosition(el: HTMLElement | null) {
  let xPos = 0;
  let yPos = 0;
  let elWalk: HTMLElement | null = el;
  while (elWalk) {
    if (elWalk.tagName === "BODY") {
      const xScroll =
        elWalk.scrollLeft || document.documentElement.scrollLeft;
      const yScroll = elWalk.scrollTop || document.documentElement.scrollTop;
      xPos += elWalk.offsetLeft - xScroll + elWalk.clientLeft;
      yPos += elWalk.offsetTop - yScroll + elWalk.clientTop;
    } else {
      xPos += elWalk.offsetLeft - elWalk.scrollLeft + elWalk.clientLeft;
      yPos += elWalk.offsetTop - elWalk.scrollTop + elWalk.clientTop;
    }
    elWalk = elWalk.offsetParent as HTMLElement | null;
  }
  return { x: xPos, y: yPos };
}

/** Horizontal page X of the text caret in an `<input>` (LTR). */
function getInputCaretPageX(input: HTMLInputElement): number {
  const carPos =
    input.selectionEnd ?? input.selectionStart ?? input.value.length;
  const cs = getComputedStyle(input);
  const measure = document.createElement("span");
  measure.setAttribute("aria-hidden", "true");
  measure.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "visibility:hidden",
    "pointer-events:none",
    "white-space:pre",
    `font:${cs.font}`,
    `font-size:${cs.fontSize}`,
    `font-family:${cs.fontFamily}`,
    `font-weight:${cs.fontWeight}`,
    `letter-spacing:${cs.letterSpacing}`,
    `text-transform:${cs.textTransform}`,
    `font-style:${cs.fontStyle}`,
    `line-height:${cs.lineHeight}`
  ].join(";");
  measure.textContent = input.value.slice(0, carPos);
  document.body.appendChild(measure);
  const textW = measure.getBoundingClientRect().width;
  document.body.removeChild(measure);

  const ir = input.getBoundingClientRect();
  const bl = parseFloat(cs.borderLeftWidth) || 0;
  const pl = parseFloat(cs.paddingLeft) || 0;
  return ir.left + window.scrollX + bl + pl + textW - input.scrollLeft;
}

type Props = {
  emailRef: RefObject<HTMLInputElement | null>;
  passwordRef: RefObject<HTMLInputElement | null>;
  showPasswordToggleRef?: RefObject<HTMLElement | null>;
  showPassword: boolean;
};

export function LoginMascot({
  emailRef,
  passwordRef,
  showPasswordToggleRef,
  showPassword
}: Props) {
  const uid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const blinkingRef = useRef<gsap.core.Tween | null>(null);
  const eyeScaleRef = useRef(1);
  const eyesCoveredRef = useRef(false);
  const resetFace = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const q = (sel: string) => svg.querySelector(sel) as SVGGElement | null;
    gsap.to([q(".eyeL"), q(".eyeR")], {
      duration: 0.6,
      x: 0,
      y: 0,
      ease: "expo.out"
    });
    gsap.to(q(".nose"), { duration: 0.6, x: 0, y: 0, rotation: 0, ease: "expo.out" });
    gsap.to(q(".mouth"), { duration: 0.6, x: 0, y: 0, rotation: 0, ease: "expo.out" });
    gsap.to(q(".chin"), { duration: 0.6, x: 0, y: 0, scaleY: 1, ease: "expo.out" });
    gsap.to([q(".face"), q(".eyebrow")], {
      duration: 0.6,
      x: 0,
      y: 0,
      skewX: 0,
      ease: "expo.out"
    });
    gsap.to(
      [q(".earL .outerEar"), q(".earR .outerEar"), q(".earL .earHair"), q(".earR .earHair"), q(".hair")],
      { duration: 0.6, x: 0, y: 0, scaleY: 1, ease: "expo.out" }
    );
  }, []);

  const calculateFaceMove = useCallback(() => {
    const email = emailRef.current;
    const svg = svgRef.current;
    if (!email || !svg || !wrapRef.current) {
      return;
    }

    const mySVG = wrapRef.current;
    const svgRect = mySVG.getBoundingClientRect();
    const scale = svgRect.width / 200;
    const svgPageX = svgRect.left + window.scrollX;
    const svgPageY = svgRect.top + window.scrollY;

    const emailRect = email.getBoundingClientRect();
    const emailPageY = emailRect.top + window.scrollY;
    const lookAtY = emailPageY + Math.min(28, emailRect.height * 0.35);

    const lookAtX = getInputCaretPageX(email);
    const screenCenter = svgPageX + svgRect.width / 2;

    const eyeLCoords = {
      x: svgPageX + 85.5 * scale,
      y: svgPageY + 78.5 * scale
    };
    const eyeRCoords = {
      x: svgPageX + 114.5 * scale,
      y: svgPageY + 78.5 * scale
    };
    const noseCoords = {
      x: svgPageX + 100 * scale,
      y: svgPageY + 84 * scale
    };
    const mouthCoords = {
      x: svgPageX + 100 * scale,
      y: svgPageY + 100 * scale
    };

    const dFromC = screenCenter - lookAtX;
    const chinMin = 0.5;

    const eyeLAngle = getAngle(
      eyeLCoords.x,
      eyeLCoords.y,
      lookAtX,
      lookAtY
    );
    const eyeRAngle = getAngle(
      eyeRCoords.x,
      eyeRCoords.y,
      lookAtX,
      lookAtY
    );
    const noseAngle = getAngle(
      noseCoords.x,
      noseCoords.y,
      lookAtX,
      lookAtY
    );
    const mouthAngle = getAngle(
      mouthCoords.x,
      mouthCoords.y,
      lookAtX,
      lookAtY
    );

    const eyeLX = Math.cos(eyeLAngle) * 20;
    const eyeLY = Math.sin(eyeLAngle) * 10;
    const eyeRX = Math.cos(eyeRAngle) * 20;
    const eyeRY = Math.sin(eyeRAngle) * 10;
    const noseX = Math.cos(noseAngle) * 23;
    const noseY = Math.sin(noseAngle) * 10;
    const mouthX = Math.cos(mouthAngle) * 23;
    const mouthY = Math.sin(mouthAngle) * 10;
    const mouthR = Math.cos(mouthAngle) * 6;
    const chinX = mouthX * 0.8;
    const chinY = mouthY * 0.5;
    let chinS = 1 - (dFromC * 0.15) / 100;
    if (chinS > 1) {
      chinS = 1 - (chinS - 1);
      if (chinS < chinMin) {
        chinS = chinMin;
      }
    }
    const faceX = mouthX * 0.3;
    const faceY = mouthY * 0.4;
    const faceSkew = Math.cos(mouthAngle) * 5;
    const eyebrowSkew = Math.cos(mouthAngle) * 25;
    const outerEarX = Math.cos(mouthAngle) * 4;
    const outerEarY = Math.cos(mouthAngle) * 5;
    const hairX = Math.cos(mouthAngle) * 6;
    const hairS = 1.2;

    const q = (sel: string) =>
      svg.querySelector(sel) as SVGGElement | SVGGElement | null;

    gsap.to(q(".eyeL"), {
      duration: 0.35,
      x: -eyeLX,
      y: -eyeLY,
      ease: "expo.out"
    });
    gsap.to(q(".eyeR"), {
      duration: 0.35,
      x: -eyeRX,
      y: -eyeRY,
      ease: "expo.out"
    });
    gsap.to(q(".nose"), {
      duration: 0.35,
      x: -noseX,
      y: -noseY,
      rotation: mouthR,
      transformOrigin: "center center",
      ease: "expo.out"
    });
    gsap.to(q(".mouth"), {
      duration: 0.35,
      x: -mouthX,
      y: -mouthY,
      rotation: mouthR,
      transformOrigin: "center center",
      ease: "expo.out"
    });
    gsap.to(q(".chin"), {
      duration: 0.35,
      x: -chinX,
      y: -chinY,
      scaleY: chinS,
      ease: "expo.out"
    });
    gsap.to(q(".face"), {
      duration: 0.35,
      x: -faceX,
      y: -faceY,
      skewX: -faceSkew,
      transformOrigin: "center top",
      ease: "expo.out"
    });
    gsap.to(q(".eyebrow"), {
      duration: 0.35,
      x: -faceX,
      y: -faceY,
      skewX: -eyebrowSkew,
      transformOrigin: "center top",
      ease: "expo.out"
    });
    gsap.to(q(".earL .outerEar"), {
      duration: 0.35,
      x: outerEarX,
      y: -outerEarY,
      ease: "expo.out"
    });
    gsap.to(q(".earR .outerEar"), {
      duration: 0.35,
      x: outerEarX,
      y: outerEarY,
      ease: "expo.out"
    });
    gsap.to(q(".earL .earHair"), {
      duration: 0.35,
      x: -outerEarX,
      y: -outerEarY,
      ease: "expo.out"
    });
    gsap.to(q(".earR .earHair"), {
      duration: 0.35,
      x: -outerEarX,
      y: outerEarY,
      ease: "expo.out"
    });
    gsap.to(q(".hair"), {
      duration: 0.35,
      x: hairX,
      scaleY: hairS,
      transformOrigin: "center bottom",
      ease: "expo.out"
    });
  }, [emailRef]);

  const setMouthFromEmail = useCallback(
    (value: string) => {
      const svg = svgRef.current;
      if (!svg) {
        return;
      }
      const mouthBG = svg.querySelector(".mouthBG") as SVGPathElement | null;
      const mouthMed = svg.querySelector(".mouthMediumBG") as SVGPathElement | null;
      const mouthLarge = svg.querySelector(".mouthLargeBG") as SVGPathElement | null;
      if (!mouthBG || !mouthMed || !mouthLarge) {
        return;
      }

      const has = value.length > 0;
      const at = value.includes("@");
      if (!has) {
        gsap.to([mouthBG, mouthMed, mouthLarge], { duration: 0.25, opacity: 0, ease: "power2.out" });
        gsap.to(mouthBG, { duration: 0.25, opacity: 1, ease: "power2.out" });
        gsap.to([svg.querySelector(".eyeL"), svg.querySelector(".eyeR")], {
          duration: 0.25,
          scale: 1,
          transformOrigin: "center center"
        });
        eyeScaleRef.current = 1;
        return;
      }
      gsap.to(mouthBG, { duration: 0.25, opacity: 0 });
      if (at) {
        gsap.to(mouthMed, { duration: 0.25, opacity: 0 });
        gsap.to(mouthLarge, { duration: 0.25, opacity: 1 });
        gsap.to([svg.querySelector(".eyeL"), svg.querySelector(".eyeR")], {
          duration: 0.25,
          scale: 0.72,
          transformOrigin: "center center"
        });
        eyeScaleRef.current = 0.72;
      } else {
        gsap.to(mouthLarge, { duration: 0.25, opacity: 0 });
        gsap.to(mouthMed, { duration: 0.25, opacity: 1 });
        gsap.to([svg.querySelector(".eyeL"), svg.querySelector(".eyeR")], {
          duration: 0.25,
          scale: 0.88,
          transformOrigin: "center center"
        });
        eyeScaleRef.current = 0.88;
      }
    },
    []
  );

  const coverEyes = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || eyesCoveredRef.current) {
      return;
    }
    const armL = svg.querySelector(".armL") as SVGGElement | null;
    const armR = svg.querySelector(".armR") as SVGGElement | null;
    const bodyN = svg.querySelector(".bodyBGnormal") as SVGPathElement | null;
    const bodyC = svg.querySelector(".bodyBGchanged") as SVGPathElement | null;
    if (!armL || !armR || !bodyN || !bodyC) {
      return;
    }
    gsap.killTweensOf([armL, armR]);
    gsap.set([armL, armR], { visibility: "visible" });
    gsap.to(armL, { duration: 0.45, x: -93, y: 10, rotation: 0, ease: "quad.out" });
    gsap.to(armR, {
      duration: 0.45,
      x: -93,
      y: 10,
      rotation: 0,
      ease: "quad.out",
      delay: 0.1
    });
    gsap.to(bodyN, { duration: 0.45, opacity: 0 });
    gsap.to(bodyC, { duration: 0.45, opacity: 1 });
    eyesCoveredRef.current = true;
  }, []);

  const uncoverEyes = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !eyesCoveredRef.current) {
      return;
    }
    const armL = svg.querySelector(".armL") as SVGGElement | null;
    const armR = svg.querySelector(".armR") as SVGGElement | null;
    const bodyN = svg.querySelector(".bodyBGnormal") as SVGPathElement | null;
    const bodyC = svg.querySelector(".bodyBGchanged") as SVGPathElement | null;
    if (!armL || !armR || !bodyN || !bodyC) {
      return;
    }
    gsap.killTweensOf([armL, armR]);
    gsap.to(armL, { duration: 1.1, y: 220, ease: "quad.out" });
    gsap.to(armL, { duration: 1.1, rotation: 105, ease: "quad.out", delay: 0.1 });
    gsap.to(armR, { duration: 1.1, y: 220, ease: "quad.out" });
    gsap.to(armR, {
      duration: 1.1,
      rotation: -105,
      ease: "quad.out",
      delay: 0.1,
      onComplete: () => {
        gsap.set([armL, armR], { visibility: "hidden" });
      }
    });
    gsap.to(bodyC, { duration: 0.45, opacity: 0 });
    gsap.to(bodyN, { duration: 0.45, opacity: 1 });
    eyesCoveredRef.current = false;
  }, []);

  const spreadFingers = useCallback(() => {
    const svg = svgRef.current;
    const two = svg?.querySelector(".twoFingers") as SVGGElement | null;
    if (two) {
      gsap.to(two, {
        duration: 0.35,
        rotation: 30,
        x: -9,
        y: -2,
        transformOrigin: "bottom left",
        ease: "power2.inOut"
      });
    }
  }, []);

  const closeFingers = useCallback(() => {
    const svg = svgRef.current;
    const two = svg?.querySelector(".twoFingers") as SVGGElement | null;
    if (two) {
      gsap.to(two, {
        duration: 0.35,
        rotation: 0,
        x: 0,
        y: 0,
        transformOrigin: "bottom left",
        ease: "power2.inOut"
      });
    }
  }, []);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    const email = emailRef.current;
    const password = passwordRef.current;
    const toggleEl = showPasswordToggleRef?.current ?? null;
    if (!svg || !email || !password) {
      return;
    }

    const armL = svg.querySelector(".armL") as SVGGElement | null;
    const armR = svg.querySelector(".armR") as SVGGElement | null;
    if (armL && armR) {
      gsap.set(armL, {
        x: -93,
        y: 220,
        rotation: 105,
        transformOrigin: "top left"
      });
      gsap.set(armR, {
        x: -93,
        y: 220,
        rotation: -105,
        transformOrigin: "top right"
      });
    }
    gsap.set(svg.querySelector(".mouth"), { transformOrigin: "center center" });

    const mouthBG = svg.querySelector(".mouthBG") as SVGPathElement | null;
    const mouthMed = svg.querySelector(".mouthMediumBG") as SVGPathElement | null;
    const mouthLarge = svg.querySelector(".mouthLargeBG") as SVGPathElement | null;
    if (mouthBG && mouthMed && mouthLarge) {
      gsap.set(mouthMed, { opacity: 0 });
      gsap.set(mouthLarge, { opacity: 0 });
      gsap.set(mouthBG, { opacity: 1 });
    }

    let activeEl: "email" | "password" | "toggle" | null = null;

    const onEmailInput = () => {
      calculateFaceMove();
      setMouthFromEmail(email.value);
    };

    const onEmailFocus = () => {
      activeEl = "email";
      email.parentElement?.classList.add("focusWithText");
      onEmailInput();
    };

    const onEmailBlur = () => {
      activeEl = null;
      setTimeout(() => {
        if (activeEl === "email") {
          return;
        }
        if (email.value === "") {
          email.parentElement?.classList.remove("focusWithText");
        }
        resetFace();
      }, 100);
    };

    const onPasswordFocus = () => {
      activeEl = "password";
      coverEyes();
    };

    const onPasswordBlur = () => {
      activeEl = null;
      setTimeout(() => {
        if (activeEl === "toggle" || activeEl === "password") {
          return;
        }
        uncoverEyes();
      }, 100);
    };

    const onToggleFocus = () => {
      activeEl = "toggle";
      coverEyes();
    };

    const onToggleBlur = () => {
      activeEl = null;
      setTimeout(() => {
        if (activeEl === "password" || activeEl === "toggle") {
          return;
        }
        uncoverEyes();
      }, 100);
    };

    const startBlinking = (delaySec: number) => {
      const d = delaySec > 0 ? delaySec : 1;
      const eyeL = svg.querySelector(".eyeL");
      const eyeR = svg.querySelector(".eyeR");
      if (!eyeL || !eyeR) {
        return;
      }
      blinkingRef.current?.kill();
      blinkingRef.current = gsap.to([eyeL, eyeR], {
        delay: d,
        duration: 0.1,
        scaleY: 0,
        yoyo: true,
        repeat: 1,
        transformOrigin: "center center",
        ease: "power1.inOut",
        onComplete: () => {
          gsap.set([eyeL, eyeR], { scaleY: eyeScaleRef.current });
          startBlinking(8 + Math.random() * 4);
        }
      });
    };

    email.addEventListener("focus", onEmailFocus);
    email.addEventListener("blur", onEmailBlur);
    email.addEventListener("input", onEmailInput);
    email.addEventListener("keyup", onEmailInput);
    email.addEventListener("click", onEmailInput);
    password.addEventListener("focus", onPasswordFocus);
    password.addEventListener("blur", onPasswordBlur);
    toggleEl?.addEventListener("focus", onToggleFocus);
    toggleEl?.addEventListener("blur", onToggleBlur);

    startBlinking(2);

    return () => {
      email.removeEventListener("focus", onEmailFocus);
      email.removeEventListener("blur", onEmailBlur);
      email.removeEventListener("input", onEmailInput);
      email.removeEventListener("keyup", onEmailInput);
      email.removeEventListener("click", onEmailInput);
      password.removeEventListener("focus", onPasswordFocus);
      password.removeEventListener("blur", onPasswordBlur);
      toggleEl?.removeEventListener("focus", onToggleFocus);
      toggleEl?.removeEventListener("blur", onToggleBlur);
      blinkingRef.current?.kill();
    };
  }, [
    emailRef,
    passwordRef,
    showPasswordToggleRef,
    calculateFaceMove,
    setMouthFromEmail,
    resetFace,
    coverEyes,
    uncoverEyes,
    spreadFingers
  ]);

  useEffect(() => {
    if (showPassword) {
      spreadFingers();
    } else {
      closeFingers();
    }
  }, [showPassword, spreadFingers, closeFingers]);

  const clipId = `${uid}-armMask`;
  const mouthMaskId = `${uid}-mouthMask`;
  const mouthPathId = `${uid}-mouthMaskPath`;

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto mb-6 h-[200px] w-[200px] shrink-0"
    >
      <div className="pointer-events-none relative h-0 w-full overflow-hidden rounded-full pb-[100%]">
        <svg
          ref={svgRef}
          className="absolute left-0 top-0 h-full w-full"
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Farmer mascot"
        >
          <defs>
            <circle id={`${uid}-armMaskPath`} cx="100" cy="100" r="100" />
            <clipPath id={clipId}>
              <use href={`#${uid}-armMaskPath`} overflow="visible" />
            </clipPath>
            <path
              id={mouthPathId}
              d="M100.2,101c-0.4,0-1.4,0-1.8,0c-2.7-0.3-5.3-1.1-8-2.5c-0.7-0.3-0.9-1.2-0.6-1.8 c0.2-0.5,0.7-0.7,1.2-0.7c0.2,0,0.5,0.1,0.6,0.2c3,1.5,5.8,2.3,8.6,2.3s5.7-0.7,8.6-2.3c0.2-0.1,0.4-0.2,0.6-0.2 c0.5,0,1,0.3,1.2,0.7c0.4,0.7,0.1,1.5-0.6,1.9c-2.6,1.4-5.3,2.2-7.9,2.5C101.7,101,100.5,101,100.2,101z"
            />
            <clipPath id={mouthMaskId}>
              <use href={`#${mouthPathId}`} overflow="visible" />
            </clipPath>
          </defs>
          <circle cx="100" cy="100" r="100" fill={MINT_BG} />
          <circle cx="100" cy="42" r="28" fill="#e8f4ee" opacity="0.55" />
          <g className="body">
            <path
              className="bodyBGnormal"
              stroke={STROKE}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={OVERALLS}
              d="M200,158.5c0-20.2-14.8-36.5-35-36.5h-14.9V72.8c0-27.4-21.7-50.4-49.1-50.8c-28-0.5-50.9,22.1-50.9,50v50 H35.8C16,122,0,138,0,157.8L0,213h200L200,158.5z"
            />
            <path
              className="bodyBGchanged"
              style={{ opacity: 0 }}
              fill={OVERALLS_HI}
              d="M200,122h-35h-14.9V72c0-27.6-22.4-50-50-50s-50,22.4-50,50v50H35.8H0l0,91h200L200,122z"
            />
            <path
              fill={SHIRT}
              d="M68 118c0-8 14-14 32-14s32 6 32 14v6c-10 4-20 6-32 6s-22-2-32-6v-6z"
              opacity="0.95"
            />
            <path
              fill={BIB}
              stroke={STROKE}
              strokeWidth="2"
              strokeLinejoin="round"
              d="M72 128c18-12 38-12 56 0v24c-9 8-19 12-28 12s-19-4-28-12v-24z"
            />
            <path
              fill="none"
              stroke={STROKE}
              strokeWidth="1.5"
              strokeDasharray="3 3"
              d="M88 138h24M94 148h12"
            />
            <ellipse cx="100" cy="188" rx="72" ry="14" fill="#8cbf8c" opacity="0.35" />
          </g>
          <path
            fill="none"
            stroke={STROKE}
            strokeWidth="2"
            strokeLinecap="round"
            d="M78 114 Q100 106 122 114"
          />
          <g className="earL">
            <g className="outerEar" fill={SKIN} stroke={STROKE} strokeWidth="2.5">
              <ellipse cx="47" cy="82" rx="11" ry="13" transform="rotate(-6 47 82)" />
              <path
                d="M42 78 Q47 86 52 78"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            <g className="earHair" fill="none" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round">
              <path d="M52 66 Q46 62 40 64" />
            </g>
          </g>
          <g className="earR">
            <g className="outerEar" fill={SKIN} stroke={STROKE} strokeWidth="2.5">
              <ellipse cx="153" cy="82" rx="11" ry="13" transform="rotate(6 153 82)" />
              <path
                d="M148 78 Q153 86 158 78"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            <g className="earHair" fill="none" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round">
              <path d="M148 66 Q154 62 160 64" />
            </g>
          </g>
          <path
            className="chin"
            d="M84.1 121.6c2.7 2.9 6.1 5.4 9.8 7.5l.9-4.5c2.9 2.5 6.3 4.8 10.2 6.5 0-1.9-.1-3.9-.2-5.8 3 1.2 6.2 2 9.7 2.5-.3-2.1-.7-4.1-1.2-6.1"
            fill="none"
            stroke={STROKE}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="face"
            fill={SKIN}
            d="M134.5,46v35.5c0,21.815-15.446,39.5-34.5,39.5s-34.5-17.685-34.5-39.5V46"
          />
          <g className="hair" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round">
            <ellipse cx="100" cy="40" rx="68" ry="16" fill={HAT_STRAW} />
            <path
              fill={HAT_STRAW}
              d="M52 38 Q100 12 148 38 L142 52 Q100 44 58 52 Z"
            />
            <rect
              x="48"
              y="44"
              width="104"
              height="10"
              rx="2"
              fill={HAT_BAND}
            />
            <ellipse cx="100" cy="52" rx="58" ry="6" fill={HAT_STRAW} />
          </g>
          <g className="eyebrow" fill="none" stroke={STROKE} strokeWidth="3" strokeLinecap="round">
            <path d="M70 56c8-3 18-4 26-1" />
            <path d="M130 56c8-3 18-4 26-1" />
          </g>
          <g className="eyeL">
            <circle cx="85.5" cy="78.5" r="3.5" fill={STROKE} />
            <circle cx="84" cy="76" r="1" fill="#ffffff" />
          </g>
          <g className="eyeR">
            <circle cx="114.5" cy="78.5" r="3.5" fill={STROKE} />
            <circle cx="113" cy="76" r="1" fill="#ffffff" />
          </g>
          <g className="mouth">
            <path
              className="mouthBG"
              fill={MOUTH_FILL}
              d="M100.2,101c-0.4,0-1.4,0-1.8,0c-2.7-0.3-5.3-1.1-8-2.5c-0.7-0.3-0.9-1.2-0.6-1.8 c0.2-0.5,0.7-0.7,1.2-0.7c0.2,0,0.5,0.1,0.6,0.2c3,1.5,5.8,2.3,8.6,2.3s5.7-0.7,8.6-2.3c0.2-0.1,0.4-0.2,0.6-0.2 c0.5,0,1,0.3,1.2,0.7c0.4,0.7,0.1,1.5-0.6,1.9c-2.6,1.4-5.3,2.2-7.9,2.5C101.7,101,100.5,101,100.2,101z"
            />
            <path
              className="mouthMediumBG"
              style={{ opacity: 0 }}
              fill={MOUTH_FILL}
              d="M95,104.2c-4.5,0-8.2-3.7-8.2-8.2v-2c0-1.2,1-2.2,2.2-2.2h22c1.2,0,2.2,1,2.2,2.2v2 c0,4.5-3.7,8.2-8.2,8.2H95z"
            />
            <path
              className="mouthLargeBG"
              style={{ opacity: 0 }}
              fill={MOUTH_FILL}
              stroke={STROKE}
              strokeWidth="2.5"
              strokeLinejoin="round"
              d="M100 110.2c-9 0-16.2-7.3-16.2-16.2 0-2.3 1.9-4.2 4.2-4.2h24c2.3 0 4.2 1.9 4.2 4.2 0 9-7.2 16.2-16.2 16.2z"
            />
            <g clipPath={`url(#${mouthMaskId})`}>
              <g className="tongue">
                <circle cx="100" cy="107" r="8" fill="#c75d7a" />
                <ellipse
                  className="tongueHighlight"
                  cx="100"
                  cy="100.5"
                  rx="3"
                  ry="1.5"
                  opacity="0.1"
                  fill="#fff"
                />
              </g>
            </g>
            <path
              clipPath={`url(#${mouthMaskId})`}
              className="tooth"
              fill="#f4fff8"
              d="M106,97h-4c-1.1,0-2-0.9-2-2v-2h8v2C108,96.1,107.1,97,106,97z"
            />
            <path
              className="mouthOutline"
              fill="none"
              stroke={STROKE}
              strokeWidth="2.5"
              strokeLinejoin="round"
              d="M100.2,101c-0.4,0-1.4,0-1.8,0c-2.7-0.3-5.3-1.1-8-2.5c-0.7-0.3-0.9-1.2-0.6-1.8 c0.2-0.5,0.7-0.7,1.2-0.7c0.2,0,0.5,0.1,0.6,0.2c3,1.5,5.8,2.3,8.6,2.3s5.7-0.7,8.6-2.3c0.2-0.1,0.4-0.2,0.6-0.2 c0.5,0,1,0.3,1.2,0.7c0.4,0.7,0.1,1.5-0.6,1.9c-2.6,1.4-5.3,2.2-7.9,2.5C101.7,101,100.5,101,100.2,101z"
            />
          </g>
          <path
            className="nose"
            d="M97.7 79.9h4.7c1.9 0 3 2.2 1.9 3.7l-2.3 3.3c-.9 1.3-2.9 1.3-3.8 0l-2.3-3.3c-1.3-1.6-.2-3.7 1.8-3.7z"
            fill={ACCENT}
          />
          <g className="arms" clipPath={`url(#${clipId})`}>
            <g className="armL" style={{ visibility: "hidden" }}>
              <polygon
                fill={SKIN}
                stroke={STROKE}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeMiterlimit="10"
                points="121.3,98.4 111,59.7 149.8,49.3 169.8,85.4"
              />
              <path
                fill={SKIN}
                stroke={STROKE}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeMiterlimit="10"
                d="M134.4,53.5l19.3-5.2c2.7-0.7,5.4,0.9,6.1,3.5v0c0.7,2.7-0.9,5.4-3.5,6.1l-10.3,2.8"
              />
              <path
                fill={SKIN}
                stroke={STROKE}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeMiterlimit="10"
                d="M150.9,59.4l26-7c2.7-0.7,5.4,0.9,6.1,3.5v0c0.7,2.7-0.9,5.4-3.5,6.1l-21.3,5.7"
              />
              <g className="twoFingers">
                <path
                  fill={SKIN}
                  stroke={STROKE}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeMiterlimit="10"
                  d="M158.3,67.8l23.1-6.2c2.7-0.7,5.4,0.9,6.1,3.5v0c0.7,2.7-0.9,5.4-3.5,6.1l-23.1,6.2"
                />
                <path
                  fill={SKIN_HI}
                  d="M180.1,65l2.2-0.6c1.1-0.3,2.2,0.3,2.4,1.4v0c0.3,1.1-0.3,2.2-1.4,2.4l-2.2,0.6L180.1,65z"
                />
                <path
                  fill={SKIN}
                  stroke={STROKE}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeMiterlimit="10"
                  d="M160.8,77.5l19.4-5.2c2.7-0.7,5.4,0.9,6.1,3.5v0c0.7,2.7-0.9,5.4-3.5,6.1l-18.3,4.9"
                />
                <path
                  fill={SKIN_HI}
                  d="M178.8,75.7l2.2-0.6c1.1-0.3,2.2,0.3,2.4,1.4v0c0.3,1.1-0.3,2.2-1.4,2.4l-2.2,0.6L178.8,75.7z"
                />
              </g>
              <path
                fill={SKIN_HI}
                d="M175.5,55.9l2.2-0.6c1.1-0.3,2.2,0.3,2.4,1.4v0c0.3,1.1-0.3,2.2-1.4,2.4l-2.2,0.6L175.5,55.9z"
              />
              <path
                fill={SKIN_HI}
                d="M152.1,50.4l2.2-0.6c1.1-0.3,2.2,0.3,2.4,1.4v0c0.3,1.1-0.3,2.2-1.4,2.4l-2.2,0.6L152.1,50.4z"
              />
            </g>
            <g className="armR" style={{ visibility: "hidden" }}>
              <path
                fill={SKIN}
                stroke={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeMiterlimit="10"
                strokeWidth="2.5"
                d="M265.4 97.3l10.4-38.6-38.9-10.5-20 36.1z"
              />
              <path
                fill={SKIN}
                stroke={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeMiterlimit="10"
                strokeWidth="2.5"
                d="M252.4 52.4L233 47.2c-2.7-.7-5.4.9-6.1 3.5-.7 2.7.9 5.4 3.5 6.1l10.3 2.8M226 76.4l-19.4-5.2c-2.7-.7-5.4.9-6.1 3.5-.7 2.7.9 5.4 3.5 6.1l18.3 4.9M228.4 66.7l-23.1-6.2c-2.7-.7-5.4.9-6.1 3.5-.7 2.7.9 5.4 3.5 6.1l23.1 6.2M235.8 58.3l-26-7c-2.7-.7-5.4.9-6.1 3.5-.7 2.7.9 5.4 3.5 6.1l21.3 5.7"
              />
              <path
                fill={SKIN_HI}
                d="M207.9 74.7l-2.2-.6c-1.1-.3-2.2.3-2.4 1.4-.3 1.1.3 2.2 1.4 2.4l2.2.6 1-3.8zM206.7 64l-2.2-.6c-1.1-.3-2.2.3-2.4 1.4-.3 1.1.3 2.2 1.4 2.4l2.2.6 1-3.8zM211.2 54.8l-2.2-.6c-1.1-.3-2.2.3-2.4 1.4-.3 1.1.3 2.2 1.4 2.4l2.2.6 1-3.8zM234.6 49.4l-2.2-.6c-1.1-.3-2.2.3-2.4 1.4-.3 1.1.3 2.2 1.4 2.4l2.2.6 1-3.8z"
              />
              <path
                fill={SKIN_HI}
                stroke={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M263.3 96.7c41.4 14.9 84.1 30.7 108.2 35.5l14-52.3C352 70 313.6 63.5 273.6 58.1"
              />
              <path
                fill={SKIN_HI}
                stroke={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M278.2 59.3l-18.6-10 2.5 11.9-10.7 6.5 9.9 8.7-13.9 6.4 9.1 5.9-13.2 9.2 23.1-.9M284.5 100.1c-.4 4 1.8 8.9 6.7 14.8 3.5-1.8 6.7-3.6 9.7-5.5 1.8 4.2 5.1 8.9 10.1 14.1 2.7-2.1 5.1-4.4 7.1-6.8 4.1 3.4 9 7 14.7 11 1.2-3.4 1.8-7 1.7-10.9M314 66.7s5.4-5.7 12.6-7.4c1.7 2.9 3.3 5.7 4.9 8.6 3.8-2.5 9.8-4.4 18.2-5.7.1 3.1.1 6.1 0 9.2 5.5-1 12.5-1.6 20.8-1.9-1.4 3.9-2.5 8.4-2.5 8.4"
              />
            </g>
          </g>
        </svg>
      </div>
      <div
        className="pointer-events-none absolute inset-0 rounded-full border-[2.5px] border-[#1a3d2e]"
        aria-hidden
      />
    </div>
  );
}
