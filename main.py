import sys
import time
import pyautogui
from PyQt5 import QtWidgets
from pywinauto.application import Application
from PIL import ImageGrab
import pytesseract

# A~B 구간 장비 리스트
DEVICE_LIST = [
    "A-cirrus6000-3", "A-visucam224",
    "B-VF-1", "B-VF-2", "B-VF-3",
    "B-cirrus6000-1", "B-cirrus6000-2",
    "B-clarus-1", "B-clarus-2", "B-iol"
]


def get_chart_id_from_drchart_window():
    """DRChart 윈도우 좌상단 영역에서 OCR로 차트번호 추출"""
    app = Application(backend="uia").connect(title_re=".*DRChart.*")
    window = app.top_window()
    rect = window.rectangle()

    # 상대 위치로 DRChart 상단 영역에서 차트번호 추출
    crop_box = (rect.left + 90, rect.top + 50, rect.left + 280, rect.top + 85)
    image = ImageGrab.grab(bbox=crop_box)

    # OCR 인식 및 숫자 추출
    text = pytesseract.image_to_string(image, config='--psm 6')
    chart_id = ''.join(filter(str.isdigit, text))[:6]
    return chart_id


def order_to_forum(chart_id, device_name):
    """ZEISS FORUM Viewer에서 자동 오더 생성"""
    app = Application(backend="uia").connect(title_re=".*FORUM Viewer.*")
    win = app.window(title_re=".*FORUM Viewer.*")
    win.set_focus()

    # 검색창에 차트번호 입력
    pyautogui.click(300, 120)  # 검색창 위치
    pyautogui.hotkey("ctrl", "a")
    pyautogui.typewrite(chart_id)
    pyautogui.press("enter")
    time.sleep(1.5)

    # 환자 리스트 클릭 → 우클릭 → 오더
    pyautogui.click(250, 220)
    time.sleep(0.3)
    pyautogui.rightClick()
    time.sleep(0.5)

    pyautogui.move(100, 10)  # 메뉴 상대 위치 (조정 가능)
    pyautogui.click()
    time.sleep(0.5)

    pyautogui.typewrite(device_name)
    pyautogui.press("enter")


class AutoOrderApp(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ZEISS 오더 자동화 (A~B 장비 전용)")
        self.resize(700, 400)

        self.status = QtWidgets.QLabel("상태: 대기 중")
        layout = QtWidgets.QVBoxLayout()
        grid = QtWidgets.QGridLayout()

        # 장비별 버튼 자동 생성
        for i, device in enumerate(DEVICE_LIST):
            btn = QtWidgets.QPushButton(device)
            btn.setFixedHeight(40)
            btn.clicked.connect(lambda _, d=device: self.order_to_device(d))
            grid.addWidget(btn, i // 3, i % 3)

        layout.addLayout(grid)
        layout.addWidget(self.status)
        self.setLayout(layout)

    def order_to_device(self, device):
        try:
            chart_id = get_chart_id_from_drchart_window()
            if not chart_id or not chart_id.isdigit():
                self.status.setText("❌ 차트번호 인식 실패 (OCR 오류)")
                return
            order_to_forum(chart_id, device)
            self.status.setText(f"✅ {chart_id} → {device} 오더 전송 완료")
        except Exception as e:
            self.status.setText(f"⚠️ 실패: {str(e)}")


if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    win = AutoOrderApp()
    win.show()
    sys.exit(app.exec_())
