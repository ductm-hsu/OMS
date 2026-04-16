/**
 * Utility hỗ trợ tính phí vận chuyển dựa trên khu vực, khối lượng và COD
 */

export const REGIONS = {
  NORTH: 'bac',
  CENTRAL: 'trung',
  SOUTH: 'nam'
};

interface CalculationParams {
  pickupProvince: { id: number; region: string };
  receiverProvince: { id: number; region: string };
  weight: number; // gram
  codAmount: number; // VNĐ
}

export const calculateShippingFee = ({
  pickupProvince,
  receiverProvince,
  weight,
  codAmount
}: CalculationParams) => {
  let baseFee = 0;
  let insuranceFee = 0;
  
  // 1. XÁC ĐỊNH LOẠI VẬN CHUYỂN
  const isSameProvince = pickupProvince.id === receiverProvince.id;
  const isSameRegion = pickupProvince.region === receiverProvince.region;

  // 2. TÍNH CƯỚC PHÍ CƠ BẢN (Biểu phí giả định)
  if (isSameProvince) {
    // Nội tỉnh: 15.000đ cho 500g đầu, mỗi 500g tiếp theo + 5.000đ
    baseFee = 15000;
    if (weight > 500) {
      baseFee += Math.ceil((weight - 500) / 500) * 5000;
    }
  } else if (isSameRegion) {
    // Nội vùng: 25.000đ cho 500g đầu, mỗi 500g tiếp theo + 8.000đ
    baseFee = 25000;
    if (weight > 500) {
      baseFee += Math.ceil((weight - 500) / 500) * 8000;
    }
  } else {
    // Liên vùng: 35.000đ cho 500g đầu, mỗi 500g tiếp theo + 12.000đ
    baseFee = 35000;
    if (weight > 500) {
      baseFee += Math.ceil((weight - 500) / 500) * 12000;
    }
  }

  // 3. TÍNH PHÍ BẢO HIỂM / THU HỘ (Ví dụ: 1% giá trị COD nếu trên 1 triệu)
  if (codAmount > 1000000) {
    insuranceFee = Math.floor(codAmount * 0.01);
  }

  const totalFee = baseFee + insuranceFee;

  return {
    baseFee,
    insuranceFee,
    totalFee
  };
};