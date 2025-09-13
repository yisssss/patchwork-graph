import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.defaults({ scroller: ".detail-scroll" });


export {
    THREE,
    OrbitControls,
    RGBELoader,
    GLTFLoader,
    EffectComposer,
    RenderPass,
    UnrealBloomPass,
};

let renderer, scene, camera, controls, canvasElement;
const cards = [];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let hideLoaderTime = 2000;

const textureLoader = new THREE.TextureLoader();
const imageCache = {}; // 전역 캐시
// ✅ public/ 은 glob에서 쓰지 않는다. src 기준으로 detailpage만 잡기
const modules = import.meta.glob('/detailpage/**/*.{png,jpg,jpeg,svg}', { eager: true, import: 'default' });

const detailImagePaths = Object.keys(modules).map((path) => {
    // 앞의 /detailpage/ 경로는 그대로 쓰면 됨
    return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
});

console.log(detailImagePaths);


async function preloadImages(paths) {
    await Promise.all(
        paths.map(
            (p) =>
                new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        imageCache[p] = img;
                        resolve();
                        console.log("✅ loaded:", img.src);
                    };
                    img.onerror = () => {
                        reject;
                        console.error("❌ failed to load:", img.src);
                    };
                    img.src = `${import.meta.env.BASE_URL}${p}`;
                })
        )
    );
    console.log("✅ All detail images preloaded");
}

function getImage(path) {
    return imageCache[path];
}

await preloadImages(detailImagePaths);

function init() {
    // 1. 렌더러 설정
    canvasElement = document.querySelector('#three-canvas');
    renderer = new THREE.WebGLRenderer({
        canvas: canvasElement,
        antialias: true,
        alpha: true,
        depthWrite: false

    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
    renderer.shadowMap.enabled = false;


    // 2. 씬 설정
    scene = new THREE.Scene();

    // 3. 카메라 설정
    camera = new THREE.PerspectiveCamera(
        28,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    camera.position.set(0, 8, 25); // 카드들이 잘 보이도록 카메라 위치 조정
    scene.add(camera);

    // 4. 컨트롤 설정
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false; // 줌 기능 비활성화
    controls.enablePan = false; // 패닝(이동) 기능 비활성화

    // --- [2단계 수정] 카메라 회전 각도 제한 ---
    // 수직(위아래) 회전 제한. 0은 맨 위(북극), Math.PI는 맨 아래(남극)
    controls.minPolarAngle = Math.PI / 3; // 아래로는 60도 이상 못 봄
    controls.maxPolarAngle = Math.PI / 2; // 위로는 수평 이상 못 봄

    // 수평(좌우) 회전 제한
    controls.minAzimuthAngle = -Math.PI * 0.2; // 왼쪽으로 45도
    controls.maxAzimuthAngle = Math.PI * 0.2;  // 오른쪽으로 45도
    // --- 여기까지 수정 ---

    // 5. 조명 설정
    const hemisphereLight = new THREE.HemisphereLight(0xffae82, 0x61c5dd, 2);
    hemisphereLight.position.set(0, -2, 0);
    scene.add(hemisphereLight);

    const pointLight = new THREE.PointLight(0xffae82, 100);
    pointLight.position.set(0, -3, 5);
    scene.add(pointLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.1);
    directionalLight.position.set(0, 0, 50);
    directionalLight.castShadow = false;
    directionalLight.shadow.blurSamples = 100;
    directionalLight.shadow.radius = 120;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;

    scene.add(directionalLight);

    const helper1 = new THREE.PointLightHelper(pointLight, 5);
    // scene.add(helper1);


    // 6. 카드 생성
    createCards();

    // 7. 이벤트 리스너 등록
    window.addEventListener('resize', onWindowResize);
    window.addEventListener("click", handleClick);
}


let isDragging = false;
let dragBlockedUntil = 0;


window.addEventListener("mousedown", () => {
    isDragging = false;
});

window.addEventListener("mousemove", () => {
    isDragging = true;
});

window.addEventListener("mouseup", () => {
    if (isDragging) {
        dragBlockedUntil = Date.now() + 200; // 200ms 동안 클릭 막음
    }
});

function handleClick(e) {
    checkDrag(e);
}

function checkDrag(event) {
    // 드래그 직후는 무시
    if (Date.now() < dragBlockedUntil) return;

    // 드래그 안 했을 때만 실행
    if (!isDragging) {
        onCardClick(event);
    }
}

function showLoader() {
    const loader = document.getElementById("loader");
    loader.classList.remove("hidden");
    // 일정 시간 후 자동으로 숨기기
    setTimeout(() => {
        loader.classList.add("hidden");
    }, 2000); // 2초 유지 (원하는 값으로 조정)
}

function hideLoader() {
    const loader = document.getElementById("loader");
    loader.classList.add("hidden");
}

// 카드별 card.svg 위치/회전값 정의
const cardOffsets = [
    { x: 0.3, y: -0.2, z: 0.01, rotZ: 0 },   // card0
    { x: 0, y: -0.4, z: 0.01, rotZ: 0 },    // card1
    { x: -0.1, y: -0.2, z: 0.01, rotZ: 0 },   // card2
    { x: 0, y: 0.1, z: 0.01, rotZ: 0 },  // card3
    { x: -0.1, y: 0, z: 0.01, rotZ: 0 },   // card4
    { x: 0, y: -0.2, z: 0.01, rotZ: 0 },   // card5
    { x: -0.15, y: -0.2, z: 0.01, rotZ: 0 },   // card5
    { x: 0, y: -0.3, z: 0.01, rotZ: 0 },   // card5
];

const sizeRate = 2.45; const cardSizeRate = 1.5;

const totalSections = 8; // 실제 챕터 수

function loadSVGAsTexture(url, targetSize = 2048) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
            // 원본 비율
            const aspect = img.width / img.height;
            const height = targetSize;
            const width = height * aspect;

            // 고해상도 캔버스 생성
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");

            // 흰 배경 대신 투명 배경 유지
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const tex = new THREE.CanvasTexture(canvas);
            tex.anisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 4;
            tex.needsUpdate = true;
            resolve({ tex, aspect });
        };
        img.onerror = reject;
    });
}


async function createCards() {
    const CARD_COUNT = 8;
    const RADIUS = 8;
    const CARD_WIDTH = 3.2;
    const CARD_HEIGHT = 3;

    const textureLoader = new THREE.TextureLoader();

    for (let i = 0; i < CARD_COUNT; i++) {
        const cardGroup = new THREE.Group();

        // (1) back.svg (고해상도 로드)
        const { tex: backTex, aspect: backAspect } = await loadSVGAsTexture(
            `${import.meta.env.BASE_URL}mainpage/SVG/back${i + 1}.svg`,
            4096
        );

        const backHeight = CARD_HEIGHT;
        const backWidth = backHeight * backAspect;

        const backMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(backWidth, backHeight),
            new THREE.MeshBasicMaterial({
                map: backTex,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false,
            })
        );
        backMesh.position.z = -0.01;
        backMesh.name = "back";
        cardGroup.add(backMesh);


        // (2) card[i].svg 이미지
        const offset = cardOffsets[i];
        const { tex: cardTex, aspect } = await loadSVGAsTexture(
            `${import.meta.env.BASE_URL}mainpage/SVG/card${i + 1}.svg`,
            4096
        );
        const height = cardSizeRate * 0.9;
        const width = height * aspect;

        const cardMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width, height),
            new THREE.MeshBasicMaterial({
                map: cardTex,
                transparent: true,
                opacity: 1,
                depthWrite: false,
            })
        );
        cardMesh.position.set(offset.x, offset.y, offset.z);
        cardMesh.rotation.z = offset.rotZ;
        cardMesh.name = 'card';
        cardMesh.userData.basePosition = cardMesh.position.clone();
        cardMesh.userData.baseRotation = cardMesh.rotation.clone();
        cardGroup.add(cardMesh);

        // (3) front.svg (고해상도 로드)
        const { tex: frontTex, aspect: frontAspect } = await loadSVGAsTexture(
            `${import.meta.env.BASE_URL}mainpage/SVG/front${i + 1}.svg`,
            4096
        );
        const frontHeight = CARD_HEIGHT;
        const frontWidth = frontHeight * frontAspect;

        const frontMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(frontWidth, frontHeight),
            new THREE.MeshBasicMaterial({
                map: frontTex,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false,
            })
        );
        frontMesh.position.set(0, 0, 0.03);
        frontMesh.name = "front";
        cardGroup.add(frontMesh);


        // (4) name.svg (multiply blend)
        const nameTex = textureLoader.load(
            `${import.meta.env.BASE_URL}mainpage/SVG/name${i + 1}.svg`,
            (tex) => {
                const aspect = tex.image.width / tex.image.height;
                const height = CARD_HEIGHT * 0.08;
                const width = height * aspect;
                nameMesh.geometry.dispose();
                nameMesh.geometry = new THREE.PlaneGeometry(width, height);
            }
        );

        const nameMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1), // 임시, 로드 이후 교체
            new THREE.MeshBasicMaterial({
                map: nameTex,
                transparent: true,
                side: THREE.DoubleSide,
                premultipliedAlpha: true,
            })
        );
        // 카드 하단 중앙 배치
        nameMesh.position.set(0, -CARD_HEIGHT / 2 - 0.4, 0.04);
        cardGroup.add(nameMesh);

        // 위치 계산
        const angle = Math.PI * 0.9 - (i * (Math.PI * 0.8 / (CARD_COUNT - 1)));
        const x = RADIUS * Math.cos(angle);
        const z = -RADIUS * Math.sin(angle);
        cardGroup.position.set(x, -3, z);
        cardGroup.lookAt(0, -3, 0);

        cardGroup.name = `card-${i}`;
        cards.push(cardGroup);
        scene.add(cardGroup);

        // renderOrder
        backMesh.renderOrder = 0;
        cardMesh.renderOrder = 1;
        frontMesh.renderOrder = 2;
        nameMesh.renderOrder = 3;
    }
}


function onCardClick(event) {
    // 마우스 좌표를 -1 ~ 1 범위로 정규화
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Raycaster 업데이트
    raycaster.setFromCamera(mouse, camera);

    // 광선과 교차하는 객체들 확인
    const intersects = raycaster.intersectObjects(cards, true); // ✅ 내부까지 탐색
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && !cards.includes(obj)) {
            obj = obj.parent; // 최상위 Group까지 거슬러 올라감
        }
        const clickedGroup = obj; // ✅ cardGroup
        animateToDetail(clickedGroup);
    }
}

function applyHover(group) {
    group.traverse(child => {
        if (child.name === "card") {
            const basePos = child.userData.basePosition;
            const baseRot = child.userData.baseRotation;

            gsap.to(child.position, {
                x: basePos.x + 0.05,
                y: basePos.y + 0.3,
                duration: 0.3, ease: "power1.out"
            });
            gsap.to(child.rotation, {
                z: baseRot.z - 0.05,
                duration: 0.3, ease: "power1.out"
            });
        }
    });
}

function resetHover(group) {
    group.traverse(child => {
        if (child.name === "card") {
            const basePos = child.userData.basePosition;
            const baseRot = child.userData.baseRotation;

            gsap.to(child.position, {
                x: basePos.x,
                y: basePos.y,
                duration: 0.3, ease: "power1.in"
            });
            gsap.to(child.rotation, {
                z: baseRot.z,
                duration: 0.3, ease: "power1.in"
            });
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);

    // ✅ 첫 렌더링 후 로딩화면 숨기기 (한번만 실행)
    if (!animate._done) {
        setTimeout(() => {
            hideLoader();
        }, hideLoaderTime);
        animate._done = true;
    }

}

init();
animate();



///////////////////////////////////////////////////---------------detail mode--------------------///////////////////////////////////////////////

let isDetailMode = false;
let teardownPinned = null;
let hoveredGroup = null;
const HEAD = -360; // 화면 하단에 보일 높이(px)


function animateToDetail(clickedGroup) {
    window.removeEventListener("click", handleClick);
    window.removeEventListener('mousemove', onMouseMove); // ✅ hover off
    isDetailMode = true;
    controls.enabled = false;

    const nameParts = clickedGroup.name.split("-");
    let section = 1; // fallback
    if (nameParts.length > 1) {
        section = parseInt(nameParts[1], 10) + 1;
    }
    console.log("섹션 번호:", section);

    // 0) 봉투와 배경 느낌 설정
    const bgColor = "#fff100";
    gsap.to('body', { backgroundColor: bgColor, duration: 1.2 });
    gsap.to('.main-page', { opacity: 0, duration: 0.8, ease: 'power1.inOut' });

    // 3) 카메라 애니메이션 (중심 맞추기)
    const targetPos = clickedGroup.position.clone();
    const camDir = targetPos.clone().normalize().multiplyScalar(5);
    const tl = gsap.timeline();
    tl.to(camera.position, {
        x: camDir.x,
        y: camDir.y - 3,
        z: camDir.z,
        duration: 2.2,
        ease: 'power2.inOut'
    }).to(controls.target, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration: 2.0,
        ease: 'power2.inOut'
    }, "<")

        // ✅ 카메라 확대 끝난 "후"에 실행
        .add(() => {
            clickedGroup.traverse(child => {
                if (child.material) {
                    gsap.to(child.material, { opacity: 0, duration: 1 });
                }
            });
        })

        // ✅ 카드 fade-out이 끝난 직후 detail-page 등장
        .add(() => {
            showDetailPage(section);
            const detailPage = document.querySelector('#detail-page');
            gsap.fromTo(detailPage,
                { opacity: 0 },
                { opacity: 1, duration: 1.5, ease: "power2.inOut" }
            );
        }, "+=0.0");
}

function goBackToHome() {
    const detailPage = document.querySelector('#detail-page');
    detailPage.classList.remove('visible');

    const tl = gsap.timeline();

    // 1) 카메라/배경 복구 + 동시에 카드 페이드인
    tl.to(camera.position, {
        x: 0,
        y: 2,
        z: 25,
        duration: 2,
        ease: 'power2.inOut'
    })
        .to(controls.target, {
            x: 0,
            y: 0,
            z: 0,
            duration: 2,
            ease: 'power2.inOut'
        }, "<") // 카메라 이동과 동시
        .to('body', { backgroundColor: '#fff', duration: 2.0 }, "<")
        .to('.main-page', { opacity: 1, duration: 2.0 }, "<")

        // ✅ 카드들을 동시에 fade-in
        .add(() => {
            cards.forEach(group => {
                group.visible = true;
                group.traverse(child => {
                    if (child.material) {
                        child.material.transparent = true;
                        // 초기 상태는 0으로 강제
                        child.material.opacity = 0;
                    }
                    if (child.userData?.basePosition) {
                        child.position.copy(child.userData.basePosition);
                    }
                    if (child.userData?.baseRotation) {
                        child.rotation.copy(child.userData.baseRotation);
                    }
                    child.scale.set(1, 1, 1);
                });
            });
            // 카드 opacity 0 → 1 애니메이션 (카메라 이동과 동시 진행)
            gsap.to(cards.map(g => g.children)
                .flat()
                .filter(m => m.material)
                .map(m => m.material),
                {
                    opacity: 1,
                    duration: 1.5,
                    ease: "power2.inOut"
                }
            );
        }, "<")
        .add(() => { hideDetailPage(); })

        ; // 카메라 이동과 동시에 실행

    // 2) 인터랙션 재활성화
    tl.add(() => {

        controls.enabled = true;
        window.addEventListener("click", handleClick);
        window.addEventListener('mousemove', onMouseMove);
        isDetailMode = false;
    });
}

async function buildDetailPage(section) {
    const page = document.getElementById("detail-page");
    page.innerHTML = ""; // 전체 비우고 새로 구성

    // 1) 상단 고정 UI
    const header = document.createElement("div");
    header.id = "detail-header";
    header.innerHTML = `<button class="back-button" type="button">↩</button>`;
    page.appendChild(header);
    header.querySelector(".back-button").addEventListener("click", goBackToHome);

    // 2) 내부 스크롤러 컨테이너
    let scroller = document.createElement("div");
    scroller.className = "detail-scroll";
    page.appendChild(scroller);

    // 3) 인트로 섹션
    const intro = document.createElement("section");
    intro.className = "detail-intro";
    intro.innerHTML = `
      <h1>Section ${section}</h1>
      <p>이 섹션의 소개 문구가 들어갑니다. (나중에 txt 로드로 교체)</p>
    `;
    scroller.appendChild(intro);

    // 4) 카드 스택
    const stack = document.createElement("section");
    stack.className = "stack";
    const wrap = document.createElement("div");
    wrap.className = "cardWrap";
    stack.appendChild(wrap);
    scroller.appendChild(stack);

    await makeCards(section, wrap);

    moveDetailPage(section, scroller);

    // ScrollTrigger 세팅 (DOM 그려진 후 안전하게 실행)
    setTimeout(() => setupPinnedStack(stack), 0);

    // 6) 미디어 로드 후 ScrollTrigger refresh
    const media = Array.from(wrap.querySelectorAll("img,video"));
    Promise.all(
        media.map(el =>
            el.tagName === "VIDEO"
                ? (el.readyState >= 2 ? Promise.resolve() : new Promise(res => el.onloadeddata = el.onerror = res))
                : (el.complete ? Promise.resolve() : new Promise(res => el.onload = el.onerror = res))
        )
    ).then(() => ScrollTrigger.refresh());
    return stack; // ✅ stack을 반환
}

async function makeCards(section, wrap) {
    let data = {};
    const base = import.meta.env.BASE_URL || "/";
    try {
        const res = await fetch(`${base}etc/caption-${section}.txt`);
        data = await res.json();
    } catch (e) {
        console.error("caption JSON 로드 실패", e);
        return;
    }

    for (const artistIndex of Object.keys(data)) {
        const artistObj = data[artistIndex];
        const card = document.createElement("div");
        card.className = "card";

        // ✅ 카드 높이 조건
        if (section === 2 || section === 7) {
            card.style.height = "1080px";
        }

        const angle = (Math.random() * 14) - 7;
        gsap.set(card, { rotate: angle });

        // --- 이미지 슬라이더 ---
        const slider = document.createElement("div");
        slider.className = "card-slider";
        card.appendChild(slider);

        const works = artistObj.works;
        const workKeys = Object.keys(works);
        let images = [];

        for (const workIndex of workKeys) {
            const work = works[workIndex];
            const basePath = `${base}detailpage/${section}/${artistIndex}-${workIndex}`;
            let el;

            if (section === 2 || section === 7) {
                // ✅ ch2, ch7은 무조건 video
                el = document.createElement("video");
                el.src = `${basePath}.mp4`;
                el.loop = true;
                el.playsInline = true;
                el.muted = true;
                el.controls = true;
            } else {
                const exts = ["png", "jpg", "jpeg", "gif"];
                let found = null;

                for (const ext of exts) {
                    const url = `${basePath}.${ext}`;
                    if (await exists(url)) {
                        found = { url, ext };
                        break;
                    }
                }

                if (!found) {
                    console.warn("파일 없음:", basePath);
                    continue;
                }
                el = document.createElement("img");
                el.src = found.url;
                el.alt = work.title;
            }

            el.style.display = (workIndex === "1") ? "block" : "none";
            slider.appendChild(el);
            images.push({ el, work });
        }

        // --- 캡션 ---
        const captionBox = document.createElement("div");
        captionBox.className = "caption";
        const capArtist = document.createElement("h3");
        capArtist.textContent = artistObj.artist;
        const capTitle = document.createElement("h2");
        const capMedium = document.createElement("p");
        const capInfo = document.createElement("p"); // ✅ p → div (flex 배치 용이)

        captionBox.appendChild(capArtist);
        captionBox.appendChild(capTitle);
        captionBox.appendChild(capMedium);
        captionBox.appendChild(capInfo);
        card.appendChild(captionBox);

        // --- 슬라이더 버튼 ---
        if (images.length > 1) {
            const prev = document.createElement("button");
            prev.className = "img-prev";
            const next = document.createElement("button");
            next.className = "img-next";

            slider.appendChild(prev);
            slider.appendChild(next);

            let current = 0;
            function updateSlide(idx) {
                images.forEach((obj, i) => {
                    obj.el.style.display = (i === idx ? "block" : "none");
                });
                capTitle.textContent = images[idx].work.title;
                capMedium.textContent = images[idx].work.medium;

                // ✅ section == 2 → information 배열 처리
                capInfo.innerHTML = "";
                if (section === 2 && Array.isArray(images[idx].work.information)) {
                    images[idx].work.information.forEach(({ name, comment }) => {
                        const row = document.createElement("div");
                        row.style.display = "flex";
                        row.style.gap = "1rem"; // 이름과 코멘트 간격
                        const nameEl = document.createElement("p");
                        nameEl.textContent = name;
                        nameEl.style.fontWeight = "bold";
                        const commentEl = document.createElement("span");
                        commentEl.textContent = comment;
                        row.appendChild(nameEl);
                        row.appendChild(commentEl);
                        capInfo.appendChild(row);
                    });
                } else {
                    capInfo.textContent = images[idx].work.information || "";
                }

                current = idx;
                prev.style.visibility = (current === 0) ? "hidden" : "visible";
                next.style.visibility = (current === images.length - 1) ? "hidden" : "visible";
            }

            prev.addEventListener("click", () => {
                if (current > 0) updateSlide(current - 1);
            });
            next.addEventListener("click", () => {
                if (current < images.length - 1) updateSlide(current + 1);
            });

            updateSlide(0);
        } else if (images.length === 1) {
            const work = works["1"];
            capTitle.textContent = work.title;
            capMedium.textContent = work.medium;

            capInfo.innerHTML = "";
            if (section === 2 && Array.isArray(work.information)) {
                work.information.forEach(({ name, comment }) => {
                    const row = document.createElement("div");
                    row.style.display = "flex";
                    row.style.gap = "2rem";
                    const nameEl = document.createElement("p");
                    nameEl.textContent = name;
                    nameEl.style.fontWeight = "bold";
                    const commentEl = document.createElement("span");
                    commentEl.textContent = comment;
                    row.appendChild(nameEl);
                    row.appendChild(commentEl);
                    capInfo.appendChild(row);
                });
            } else {
                capInfo.textContent = work.information || "";
            }
        }
        if (section === 8) {
const infoPs = card.querySelectorAll(".caption p");
            if (infoPs.length > 1) {
                const infoP = infoPs[1];
                const link = document.createElement("a");
                link.href = "https://www.instagram.com/graph._.party/";
                link.target = "_blank";
                link.textContent = infoP.textContent;
                infoP.textContent = "";      // 기존 텍스트 지우고
                infoP.appendChild(link);     // <a> 삽입
            }
        }

        wrap.appendChild(card);
    }
}


async function exists(url) {
    try {
        const res = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (res.ok && res.headers.get("content-type")?.startsWith("image")) {
            return true;
        }
    } catch { }
    try {
        const res = await fetch(url, { method: "GET", cache: "no-store" });
        if (res.ok && res.headers.get("content-type")?.startsWith("image")) {
            return true;
        }
    } catch { }
    return false;
}

function moveDetailPage(section, scroller) {
    const nav = document.createElement("div");
    nav.id = "detail-nav";

    const prevBtn = document.createElement("button");
    prevBtn.id = "prev-chapter";
    prevBtn.className = "arrow-btn left";

    const nextBtn = document.createElement("button");
    nextBtn.id = "next-chapter";
    nextBtn.className = "arrow-btn right";

    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    scroller.appendChild(nav);

    // === 버튼 상태 세팅 ===
    function setArrowState(btn, side, state) {
        btn.style.backgroundImage = `url('${import.meta.env.BASE_URL}etc/SVG/${side}-${state}.svg')`;
        btn.style.backgroundRepeat = "no-repeat";
        btn.style.backgroundPosition = "center";
        btn.style.backgroundSize = "contain";
        btn.style.margin = "60px";
        btn.style.width = "32px";
        btn.style.height = "32px";
        btn.style.border = "none";
        btn.style.cursor = "pointer";
    }

    setArrowState(prevBtn, "left", "passive");
    setArrowState(nextBtn, "right", "passive");


    prevBtn.style.visibility = (section === 1) ? "hidden" : "visible";
    nextBtn.style.visibility = (section === totalSections) ? "hidden" : "visible";

    ["mouseenter", "mousedown"].forEach(ev => {
        prevBtn.addEventListener(ev, () => setArrowState(prevBtn, "left", "active"));
        nextBtn.addEventListener(ev, () => setArrowState(nextBtn, "right", "active"));
    });
    ["mouseleave", "mouseup"].forEach(ev => {
        prevBtn.addEventListener(ev, () => setArrowState(prevBtn, "left", "passive"));
        nextBtn.addEventListener(ev, () => setArrowState(nextBtn, "right", "passive"));
    });

    // === 버튼 기능 (이전/다음 챕터 이동)
    prevBtn.addEventListener("click", () => {
        if (section > 1) {
            showDetailPage(section - 1); // ✅ hideDetailPage() 없이 바로 교체
        }
    });
    nextBtn.addEventListener("click", () => {
        if (section < totalSections) {
            showDetailPage(section + 1);
        }
    });


}

function setupPinnedStack(stack) {

    if (!stack) {
        console.warn("setupPinnedStack: stack이 넘어오지 않았음");
        return;
    }
    const wrap = stack.querySelector(".cardWrap");
    if (!wrap) {
        console.warn("setupPinnedStack: .cardWrap 없음");
        return;
    }


    const cards = gsap.utils.toArray(wrap.querySelectorAll(".card"));
    if (cards.length === 0) {
        console.warn("setupPinnedStack: 카드 없음");
        return;
    }

    const HEAD = -1080;

    const vh = window.innerHeight;
    const cardH = wrap.offsetHeight;

    const startY = Math.max(0, vh - HEAD - cardH);
    const endY = -(cardH + 40);

    gsap.set(cards, { zIndex: (i, _, a) => a.length - i });

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: stack,
            start: "top top",
            end: () => "+=" + (cards.length * 600), // ✅ 1200 → 600으로 줄임
            scrub: 0.6,
            pin: true,
            pinSpacing: true,
            pinReparent: true,
            anticipatePin: 0,
            pinType: "transform"
        }
    });

    const SEG = 0.26;
    cards.forEach((card, i) => {
        tl.fromTo(card, { y: startY }, { y: endY, ease: "none", force3D: true }, i * SEG - 0.05);
    });

    ScrollTrigger.refresh();
}

function showDetailPage(section) {
    buildDetailPage(section);
    const page = document.getElementById("detail-page");
    page.classList.add("visible");
    gsap.fromTo(page, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "power2.inOut" });
}

function hideDetailPage() {
    const detailPage = document.getElementById("detail-page");
    gsap.to(detailPage, {
        opacity: 0, duration: 0.5, ease: "power1.inOut",
        onComplete: () => {
            detailPage.classList.remove("visible");
            detailPage.innerHTML = "";
        }
    });
}


////////////////////////////////////////////////////////----------window resizing--------------------/////////////////////////////////////

window.addEventListener("mousemove", onMouseMove);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateCursor(x, y) {
    const cursor = document.querySelector('.cursor');
    cursor.style.left = (x - 10) + 'px';
    cursor.style.top = (y - 10) + 'px';
}

document.addEventListener('mousemove', (e) => {
    updateCursor(e.pageX, e.pageY);
});

document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
        updateCursor(e.touches[0].pageX, e.touches[0].pageY);
    }
});
document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
        updateCursor(e.touches[0].pageX, e.touches[0].pageY);
    }
});
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cards, true);

    if (intersects.length > 0) {
        // 최상위 group 찾기
        let obj = intersects[0].object;
        while (obj.parent && !cards.includes(obj)) {
            obj = obj.parent;
        }
        const group = obj;

        if (hoveredGroup !== group) {
            // 이전 hover 해제
            if (hoveredGroup) resetHover(hoveredGroup);
            // 새 hover 적용
            applyHover(group);
            hoveredGroup = group;
        }
    } else {
        // hover 해제
        if (hoveredGroup) {
            resetHover(hoveredGroup);
            hoveredGroup = null;
        }
    }
}

