import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { BrandModule } from 'src/modules/brand/brand.module';
import { CategoriesModule } from 'src/modules/categories/categories.module';
import { ProductsModule } from 'src/modules/products/products.module';
import { UsersModule } from 'src/modules/users/users.module';
import { SliderModule } from './slider/slider.module';
import { AddressModule } from './address/address.module';
import { ContactInfoModule } from 'src/modules/contacts/contact-info/contact-info.module';
import { ContactModule } from 'src/modules/contacts/contact/contact.module';
import { ProcedureModule } from './procedure/procedure.module';
import { CmsModule } from 'src/modules/cms/cms.module';
import { NotificationModule } from './notification/notification.module';
import { OrderModule } from './order/order.module';
import { CartModule } from './cart/cart.module';
import { GlobalSearchModule } from './global-search/global-search.module';
import { FavouritesModule } from './favourites/favourites.module';
import { PagesModule } from './pages/pages.module';
import { AdminDashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    BrandModule,
    SliderModule,
    AddressModule,
    ContactInfoModule,
    ContactModule,
    ProcedureModule,
    CmsModule,
    NotificationModule,
    OrderModule,
    CartModule,
    GlobalSearchModule,
    FavouritesModule,
    PagesModule,
    AdminDashboardModule
  ],
  controllers: [],
  providers: [],
})
export class DomainModule {}
