
import jacket from "../assets/bag.webp";
import headphone from "../assets/headphone.jpg";
import iphone from "../assets/15.webp";
const About = () => {
  return (
    <>
      <section className="py-12  bg-purple-600">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-white">About Us</h2>
            <p className="text-lg text-white mt-4">
              Learn more about our journey, mission, and values.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-around">
            <div className="md:w-1/2 mb-8 md:mb-0">
              <h3 className="text-2xl font-semibold text-white mb-4">
                Our Mission
              </h3>
              <p className="text-lg text-white">
                Our mission is to provide the highest quality products to our
                customers while maintaining ethical and sustainable practices.
                We believe in delivering excellence in every aspect of our
                business, from product development to customer service.
              </p>
            </div>

            <div className="md:w-1/2">
              {/* <img
                src="https://via.placeholder.com/400x250"
                alt="Our Mission"
                className="rounded shadow-md"
              /> */}
               { <img src={jacket} alt="jacket" /> }
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-around mt-12">
            <div className="md:w-1/2 mb-8 md:mb-0 order-2 md:order-1">
            { <img src={headphone} alt="jacket" className="h-60 w-60" /> }
            </div>
            <div className="md:w-1/2 order-1 md:order-2">
              <h3 className="text-2xl font-semibold text-white mb-4">
                Our Vision
              </h3>
              <p className="text-lg text-white">
                We envision a world where fashion and sustainability coexist
                harmoniously. Our goal is to lead the industry by setting new
                standards for environmentally friendly practices while
                continuing to offer the latest trends and styles.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-around mt-12">
            <div className="md:w-1/2 mb-8 md:mb-0">
              <h3 className="text-2xl font-semibold text-white mb-4">
                Our History
              </h3>
              <p className="text-lg text-white">
                Founded in 2020, we started as a small online boutique with a
                big dream: to make high-quality fashion accessible to everyone.
                Over the years, we've grown into a trusted brand with a loyal
                customer base, thanks to our commitment to quality, integrity,
                and customer satisfaction.
              </p>
            </div>

            <div className="md:w-1/2">
              {/* <img
                src="https://via.placeholder.com/400x250"
                alt="Our History"
                className="rounded shadow-md"
              /> */}
              { <img src={iphone} alt="jacket" className="h-80"/> }
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default About;
