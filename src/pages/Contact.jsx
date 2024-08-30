import ContactForm from "../components/ContactForm";

const Contact = () => {
  return (
    <div>
      <ContactForm />
      <div className="max-w-lg mx-auto p-6 bg-purple-400 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-center">Contact Us</h2>
        <p className="text-lg mb-3">
          <strong>Address:</strong> 123 Main Street, City, Country
        </p>
        <p className="text-lg mb-3">
          <strong>Phone:</strong> +123 456 7890
        </p>
        <p className="text-lg mb-3">
          <strong>Email:</strong> contact@organization.com
        </p>
      </div>
      <h2 className="text-center ">Here is google map</h2>
      <div className="mt-6 w-full h-64 flex items-center justify-center ">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3532.381063729674!2d85.31685772464266!3d27.70551842557358!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39eb19075849239d%3A0x4ddaddd1271c3890!2sBagbazar%2C%20Kathmandu%2044600!5e0!3m2!1sen!2snp!4v1723720547517!5m2!1sen!2snp"
          allowfullscreen=""
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>
    </div>
  );
};

export default Contact;
