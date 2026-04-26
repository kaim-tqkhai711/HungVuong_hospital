# Giải thích chi tiết mã nguồn R (assignment_gpu)

Tài liệu này giải thích chi tiết từng phần, từng dòng của đoạn mã R mà bạn cung cấp. Nó được viết một cách dễ hiểu nhất, dành cho người hoàn toàn mới, chưa từng tiếp xúc với ngôn ngữ R hay khái niệm lập trình trước đây.

Về cơ bản, đoạn mã này thực hiện quá trình **Phân tích Dữ liệu (Data Analysis)** trên một tập dữ liệu về Card đồ họa (GPU). Quá trình bao gồm: nạp dữ liệu, làm sạch dữ liệu, vẽ biểu đồ để quan sát, xây dựng mô hình dự đoán và kiểm định thống kê.

---

## 1. Nạp các thư viện (Call libraries)
Trong R, "thư viện" (library hoặc package) giống như các hộp dụng cụ chứa sẵn những công cụ (hàm) để làm những việc đặc biệt mà phần mềm R cơ bản không có sẵn. Lệnh `library(...)` giúp mở các hộp dụng cụ này ra để dùng.

```r
library(ggplot2)     # Dùng để vẽ các biểu đồ rất đẹp mắt và chuyên nghiệp.
library(reshape2)    # Dùng để biến đổi hình dạng dữ liệu (sắp xếp lại dữ liệu để vẽ biểu đồ tương quan).
library(caret)       # Công cụ mạnh mẽ hỗ trợ việc dạy cho máy tính học tập (Machine Learning).
library(lattice)     # Một công cụ vẽ biểu đồ khác, ở đoạn mã này hỗ trợ vẽ biểu đồ hộp (boxplot).
library(questionr)   # Cung cấp các hàm giúp đếm số lượng dữ liệu lỗi/bị thiếu nhanh chóng.
library(car)         # Dùng cho các phép kiểm định thống kê chuyên sâu.
library(effectsize)  # Dùng để đo lường mức độ ảnh hưởng của các biến số trong toán thống kê.
```

## 2. Tạo các thư mục lưu kết quả (Create directories for results)
Khi vẽ biểu đồ và làm sạch dữ liệu, chúng ta cần chỗ lưu trên máy tính. Đoạn này tự động tạo ra một loạt thư mục (folders) để phân loại kết quả cho gọn gàng.

```r
# Tạo một danh sách (vector) chứa tên các thư mục cần tạo
dirs <- c("Results",
          "Results/Cleaned",
          "Results/Histogram",
          "Results/Boxplot",
          "Results/Correlation",
          "Results/Missing",
          "Results/Residual",
          "Results/Scatter",
          "Results/ANOVA")

# 'for' là vòng lặp, nó sẽ đi qua từng tên thư mục trong danh sách 'dirs' ở trên
for (dir in dirs) {
  # Kiểm tra xem thư mục đó đã tồn tại trên máy tính chưa
  if (!dir.exists(dir)) {
    # Nếu chưa tồn tại, hãy tạo thư mục đó. 
    # 'recursive = TRUE' nghĩa là nếu tạo thư mục con mà thư mục cha chưa có thì tạo luôn cả thư mục cha.
    dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  }
}
```

## 3. Đọc dữ liệu (Read CSV file)
Máy tính cần lấy dữ liệu từ một file Excel định dạng CSV tên là "All_GPUs.csv" để bắt đầu làm việc.

```r
gpu_data <- read.csv("All_GPUs.csv") # Đọc file và lưu toàn bộ dữ liệu vào một biến tên là 'gpu_data'.
head(gpu_data)                       # In ra 6 dòng đầu tiên của bảng dữ liệu để con người xem thử hình thù nó ra sao.
```

## 4. Kiểm tra dữ liệu bị khuyết/trống (Check missing data)
Dữ liệu thu thập ngoài đời thực thường không hoàn hảo, có nhiều ô bị bỏ trống hoặc chứa khoảng trắng rác. R gọi dữ liệu bị thiếu là `NA` (Not Available). Đoạn này đi lùng sục các lỗi đó và quy hết về chuẩn `NA` để dễ xử lý.

```r
gpu_data[gpu_data == ""] <- NA       # Đổi các ô trống trơn không có chữ gì thành chuẩn NA.
# Dòng dưới này tìm các ô bị dính các ký tự xuống dòng và dấu cách lạ (như "^\\n-␣$") rồi thay nó thành NA.
gpu_data[] <- lapply(gpu_data, function(x) gsub("^\\n-␣$", NA, x))
gpu_data[gpu_data == "NA"] <- NA     # Nếu vô tình có chữ "NA" gõ bằng tay, cũng biến nó thành kiểu dữ liệu trống chuẩn.
freq.na(gpu_data)                    # Lệnh này đếm xem mỗi cột đang bị thiếu bao nhiêu dữ liệu và in ra.
```

## 5. Chọn lọc các thông số (Collect data)
Bảng dữ liệu gốc có thể có quá nhiều cột không cần dùng tới. Đoạn này chỉ nhặt ra 7 cột quan trọng nhất.

```r
# Tạo một bảng mới tên là 'main_data' chỉ chứa 7 cột được liệt kê dưới đây
main_data <- gpu_data[c("Memory_Bandwidth", "Memory_Speed", "L2_Cache",
                        "Memory_Bus", "Shader", "Dedicated", "Manufacturer")]
head(main_data)                      # Xem thử 6 dòng đầu tiên của bảng mới này.
```

## 6. Làm sạch lại trên bảng dữ liệu mới
Người lập trình lại thực hiện bước dọn rác như mục 4, nhưng lần này là dọn trên cái bảng `main_data` vừa tạo ra.
Sau đó, họ lập ra một bảng báo cáo tóm tắt xem mức độ thiếu hụt dữ liệu là bao nhiêu %.

```r
# Bỏ qua vài dòng lặp lại... 

# Tạo một bảng thống kê (na_summary) báo cáo số lượng và tỷ lệ % dữ liệu bị khuyết của từng cột
na_summary <- data.frame(
  Column = names(main_data),                                     # Tên cột
  NA_Count = sapply(main_data, function(x) sum(is.na(x))),       # Tổng số ô bị khuyết
  NA_Percentage = sapply(main_data, function(x) mean(is.na(x)) * 100) # Tính tỷ lệ % ô bị khuyết
)
print(na_summary) # In cái bảng báo cáo này ra màn hình

# TẠO BẢNG CHÍNH THỨC SẠCH SẼ (new_main_data):
new_main_data <- na.omit(main_data) # Lệnh na.omit sẽ xóa sổ tất cả các hàng dữ liệu có chứa bất kỳ ô NA nào. 
head(new_main_data)
```

## 7. Vẽ biểu đồ mức độ dữ liệu thiếu (Plot statistical data)
Sử dụng công cụ `ggplot2` để vẽ biểu đồ hình cột, giúp dễ nhìn xem cột nào bị mất dữ liệu nhiều nhất.

```r
# Lấy dữ liệu từ bảng na_summary để vẽ. Trục x là tên Cột, trục y là % Bị thiếu.
ggplot(na_summary, aes(x = Column, y = NA_Percentage)) +
  geom_bar(stat = "identity", fill = "steelblue", width = 0.5) +  # Vẽ các cột màu xanh thép (steelblue)
  geom_text(...) +                                                # Ghi thêm con số % lên đầu mỗi cái cột
  labs(...) +                                                     # Đặt tiêu đề cho biểu đồ, ghi chú trục x, trục y
  theme_minimal() + ... + coord_flip()                            # Làm nền biểu đồ trong sáng đẹp hơn và lật ngang biểu đồ để dễ đọc chữ

# Lưu hình ảnh biểu đồ vừa vẽ ra file hình ảnh PNG.
ggsave("Results/Missing/missing_data_plot.png", width = 10, height = 7, units = "in", dpi = 300, bg = "white")
```

## 8. Xử lý dữ liệu dạng chữ thành dạng số
Một số dữ liệu như băng thông (Memory Bandwidth) đang chứa cả chữ và số (ví dụ: "250 GB/s"). Máy tính không thể làm toán với chữ, nên cần dùng code để cắt bỏ các chữ như "GB/s", "MHz" đi, chỉ giữ lại số.

```r
columns_to_clean <- c("Memory_Bandwidth", "Memory_Bus", "Memory_Speed") # Chọn 3 cột cần cạo lớp chữ đi

# Tạo ra một quy trình (hàm) cắt chữ tên là 'remove_units'
remove_units <- function(column) {
  cleaned_column <- gsub("[^0-9.]", "", column) # Tìm tất cả mọi thứ KHÔNG phải là số (0-9) hay dấu chấm (.) và xóa nó đi.
  as.numeric(cleaned_column)                    # Ép các số còn lại trở thành định dạng "Số thực" (có thể cộng trừ nhân chia).
}

# Áp dụng quy trình cắt chữ đó cho 3 cột đã chọn ở trên
new_main_data[columns_to_clean] <- lapply(new_main_data[columns_to_clean], remove_units)

# Một quy trình khác phức tạp hơn tên 'reformat_cache' để xử lý cột "L2_Cache"
# Lý do: Trong L2 Cache đôi khi ghi theo kiểu "256 KB (x4)". Ta phải tách số 256, nhân với 4, rồi xóa chữ KB.
reformat_cache <- function(cache_values) { ... } 
new_main_data["L2_Cache"] <- lapply(new_main_data["L2_Cache"], reformat_cache) # Áp dụng hàm trên cho L2_Cache

# Ghi bảng dữ liệu đã biến thành số sạch sẽ này ra một file CSV mới để lưu trữ.
write.csv(new_main_data, "Results/Cleaned/cleaned_data.csv", row.names = FALSE)
```

## 9. Định dạng các cột phân loại (transform classification)
Các thông tin mang tính chất xếp loại (như hãng sản xuất Nvidia hay AMD, Card rời hay Card tích hợp) cần được ép kiểu thành `factor` (một kiểu danh mục). Như vậy R mới biết đường phân loại chúng ra khi làm toán thống kê thay vì xem chúng như những câu chữ ngẫu nhiên.

```r
new_main_data$Shader <- as.factor(new_main_data$Shader)
new_main_data$Dedicated <- as.factor(new_main_data$Dedicated)
new_main_data$Manufacturer <- as.factor(new_main_data$Manufacturer)
```

## 10. Biến đổi dữ liệu Logarit và Mũ
*Lưu ý: Phần code này về mặt logic đang tự triệt tiêu lẫn nhau (không thay đổi giá trị gì). Lập trình viên có thể viết ra để thử nghiệm.*

Đầu tiên, họ lấy logarit tự nhiên (`log`) của các con số. Việc này thường dùng trong khoa học dữ liệu để kéo những con số quá "khổng lồ" nhỏ lại, dễ phân tích hơn. Cộng thêm 1 để tránh lỗi lấy `log(0)`.
Sau đó, ngay lập tức họ lại lấy hàm lượng giác mũ (`exp`) của chính số đó và trừ đi 1. Hàm lượng giác mũ là phép toán ngược lại của hàm logarit. Suy ra, dữ liệu lại quay về chính xác như hình dáng ban đầu chưa làm gì.

```r
# Chuyển đổi sang logarit
new_main_data$Memory_Bandwidth <- log(new_main_data$Memory_Bandwidth + 1)
...
# Ngay lập tức dùng exp để đảo ngược đưa về như cũ
new_main_data$Memory_Bandwidth <- exp(new_main_data$Memory_Bandwidth) - 1
...
```

## 11. Vẽ các Biểu đồ Tần suất (Histograms)
Biểu đồ Tần suất là biểu đồ nhiều cột dính liền nhau, giúp ta xem "Dữ liệu tập trung đông nhất ở đâu". Ví dụ: Có bao nhiêu cái GPU có tốc độ băng thông tầm 100GB/s, bao nhiêu cái có 500GB/s?

Đoạn mã này dùng `geom_histogram` để vẽ liên tục 4 biểu đồ cho `Memory_Bandwidth`, `Memory_Speed`, `L2_Cache`, và `Memory_Bus` với nhiều màu sắc khác nhau (xanh lá, xanh biển, hồng, vàng). Tất cả được lưu bằng lệnh `ggsave` vào thư mục Histogram.

## 12. Vẽ các Biểu đồ Phân tán (Scatter plots)
Biểu đồ phân tán (gồm rất nhiều dấu chấm) giúp xem xét mối quan hệ giữa 2 thông số. Ở đây, người viết đang tò mò: Tốc độ bộ nhớ (`Memory_Speed`), Bộ nhớ đệm (`L2_Cache`), độ rộng Bus (`Memory_Bus`) có làm cho Băng thông (`Memory_Bandwidth`) chạy nhanh theo không?

Code dùng `geom_point` để vẽ 3 biểu đồ (những dấu chấm màu xanh lá, đỏ, xanh lam). Hình ảnh được tự động lưu vào thư mục Scatter.

## 13. Vẽ Biểu đồ Tương quan (Correlation matrix)
Phần này chấm điểm độ "thân thiết" (tương quan) giữa các thông số số học.
```r
cor_matrix <- cor(data)         # Lệnh cor() tính toán toán học xem hai cột dữ liệu nào chạy song song với nhau.
cor_data <- melt(cor_matrix)    # Biến đổi bảng điểm số thành dạng danh sách để dễ vẽ.

# Vẽ biểu đồ lưới nhiệt (heatmap)
ggplot(cor_data, aes(x = Var1, y = Var2, fill = value)) +
  geom_tile(color = "white") +
  scale_fill_gradient2(...)     # Quy định màu: Đỏ là tương quan thuận (anh tăng tôi tăng), Xanh là tương quan nghịch (anh tăng tôi giảm).
```

## 14. Vẽ Biểu đồ Hộp (Boxplots)
Biểu đồ hộp (Boxplot) là một cái hình chữ nhật có râu ở trên và dưới. Nó tóm tắt tuyệt vời 5 thứ: Giá trị nhỏ nhất, Lớn nhất, Ở giữa (Trung vị), và những GPU có thông số "đột biến" (outlier) vượt ra ngoài chuẩn mực thông thường.

Đoạn code đầu tiên dùng hàm `boxplot()` gốc của R để vẽ nhanh 4 biểu đồ hộp màu xanh nhạt (`lightblue`) rồi lưu bằng cụm lệnh `png(...)` và `dev.off()`.

Sau đó, người viết đổi sang dùng công cụ `ggplot2` (với lệnh `geom_boxplot`) để vẽ thêm 3 biểu đồ xịn xò hơn, có màu mè hơn (`fill = "lightgreen"`, viền xanh đậm) để xem sự phân bố của băng thông phụ thuộc vào các thông số khác ra sao. 

## 15. Dạy Máy tính - Mô hình Hồi quy Tuyến tính (Linear regression model)
Đây là phần thú vị nhất: Machine Learning. Cố gắng tìm ra 1 công thức toán học tính Băng thông (`Memory_Bandwidth`) từ 3 yếu tố còn lại.

```r
# Đặt "hạt giống" (seed) để khi chia bài (chia dữ liệu) ngẫu nhiên, sau này chạy lại code vẫn chia y hệt như cũ, không bị thay đổi ngẫu nhiên.
set.seed(15042026) 

# Chia dữ liệu làm 2 phần: 80% (train_data) để đưa cho máy tính học tìm ra quy luật. 20% (test_data) cất đi để xíu nữa kiểm tra bài xem máy tính đoán đúng không.
train_index <- createDataPartition(new_main_data$Memory_Bandwidth, p = 0.8, list = FALSE)
train_data <- new_main_data[train_index, ]
test_data <- new_main_data[-train_index, ]

# Hàm lm (Linear Model) bắt máy tính tìm ra một phương trình toán học kết nối chúng lại.
model <- lm(Memory_Bandwidth ~ Memory_Speed + L2_Cache + Memory_Bus, data = train_data)
summary(model)   # In ra báo cáo: Mô hình này học giỏi cỡ nào? (sai số bao nhiêu, biến nào quan trọng nhất).

# Vẽ biểu đồ sai số (residual) để các nhà khoa học ngắm xem mô hình có bị thiên vị hay không.
plot(model)
```

## 16. Phân tích Phương sai (ANOVA)
ANOVA giúp trả lời câu hỏi: "Giữa Hãng sản xuất Nvidia, AMD và Intel, băng thông của card đồ họa có thực sự khác biệt đáng kể hay không? Hay sự khác nhau chỉ là do ngẫu nhiên may rủi?".

**Phần 1: Nghiên cứu theo Hãng sản xuất (Manufacturer)**
```r
anova_manufacturer <- aov(...)            # Chạy thuật toán thống kê ANOVA.
summary(anova_manufacturer)               # Xem kết quả (nếu giá trị P-value nhỏ hơn 0.05 nghĩa là CÓ sự khác biệt thật sự giữa các hãng).

tukey_manufacturer <- TukeyHSD(...)       # Bài test Tukey: So sánh lần lượt từng cặp một (Nvidia vs AMD, Nvidia vs Intel...) xem ai nhanh hơn ai.
eta_manu <- eta_squared(...)              # Tính toán xem việc "Hãng nào sản xuất" đóng vai trò chiếm bao nhiêu phần trăm (%) quyết định tốc độ Băng thông.

levene_manu <- leveneTest(...)            # Bài test Levene: Xem độ phong phú chủng loại giữa các hãng có ngang nhau không (phương sai có bằng nhau không).
welch_manu <- oneway.test(...)            # Welch's ANOVA: Nếu không qua bài test Levene (bị rớt), ta xài bài test Welch này để thay thế cho ANOVA chuẩn.
```
Sau đó hệ thống sẽ vẽ một biểu đồ hộp (Boxplot) đặt các hãng cạnh nhau để xem bằng mắt cho dễ hiểu, và lưu nó lại.

**Phần 2: Nghiên cứu theo Loại Card (Dedicated)**
Đoạn mã này làm y hệt các phép toán kiểm định ở phần 1, nhưng mục tiêu bây giờ là so sánh giữa Card Đồ Họa Rời và Card Đồ Họa Tích hợp (Dedicated: Yes/No) xem băng thông bên nào có sự khác biệt rõ nét hơn và khác biệt bao nhiêu. Điểm khác là vì chỉ có 2 loại Yes/No nên không cần làm bài test so sánh bắt cặp (Tukey).
Mọi kết quả cũng được hiển thị thành biểu đồ và lưu vào thư mục `Results/ANOVA`.

---
*Hy vọng tài liệu này giúp bạn hiểu tường tận mọi dòng lệnh R trong dự án này!*
