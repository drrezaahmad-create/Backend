
interface ProductWithFavourite {
    _id: any;
    name: string;
    description: string;
    price: number;
    stock: number;
    category: any;
    brand: any;
    procedure: any;
    images: string[];
    availability: string;
    salesCount: number;
    views: number;
    isFeatured: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    isFavourite?: boolean; 
  }