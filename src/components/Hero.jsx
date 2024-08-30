import { BiRightArrowAlt } from "react-icons/bi";
import jacket from "../assets/bag.webp";
import { Link } from "react-router-dom";
import { PRODUCTS_ROUTE } from "../constants/routes";

const Hero = () => {
  return (
    <section className="py-12 md:py-0 bg-purple-600">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-around w-full">
          <div className="md:w-1/3">
            
            <h1 className="text-6xl mt-5 mb-3">Dashain Offer</h1>
            <p className="text-lg text-gray-700  ml-1">
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Minus
              deleniti hic porro ab iusto qui nam doloremque eaque. Praesentium,
              veritatis.
            </p>
            <Link
              to={PRODUCTS_ROUTE}
              className="bg-black py-2 px-8 text-white flex items-center mt-5 w-max"
            >
              SHOP NOW <BiRightArrowAlt className="ml-2" />
            </Link>
          </div>
          <div className="md:w-1/2">
            { <img src={jacket} alt="jacket" /> }
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;